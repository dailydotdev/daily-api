import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testMutationErrorCode,
  testQueryErrorCode,
} from './helpers';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { usersFixture, plusUsersFixture } from './fixture/user';
import { User, PersonalAccessToken } from '../src/entity';
import { Context } from '../src/Context';
import {
  generatePersonalAccessToken,
  hashPersonalAccessToken,
  validatePersonalAccessToken,
  revokeAllUserTokens,
} from '../src/common/personalAccessToken';
import {
  MAX_PERSONAL_ACCESS_TOKENS_PER_USER,
  PERSONAL_ACCESS_TOKEN_PREFIX,
} from '../src/entity/PersonalAccessToken';
import { v4 as uuidv4 } from 'uuid';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string | undefined;
let isPlus: boolean;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () =>
      new MockContext(
        con,
        loggedUser,
        [],
        undefined,
        false,
        isPlus,
      ) as unknown as Context,
  );
  client = state.client;
});

beforeEach(async () => {
  loggedUser = undefined;
  isPlus = false;
  jest.clearAllMocks();
});

afterAll(() => disposeGraphQLTesting(state));

describe('personal access token utilities', () => {
  beforeEach(async () => {
    await saveFixtures(con, User, usersFixture);
    await saveFixtures(con, User, plusUsersFixture);
  });

  describe('generatePersonalAccessToken', () => {
    it('should generate token with correct prefix', () => {
      const result = generatePersonalAccessToken();

      expect(result.token).toMatch(
        new RegExp(`^${PERSONAL_ACCESS_TOKEN_PREFIX}`),
      );
    });

    it('should generate unique tokens', () => {
      const token1 = generatePersonalAccessToken();
      const token2 = generatePersonalAccessToken();

      expect(token1.token).not.toEqual(token2.token);
      expect(token1.tokenHash).not.toEqual(token2.tokenHash);
    });

    it('should generate consistent hash for same token', () => {
      const { token, tokenHash } = generatePersonalAccessToken();
      const rehash = hashPersonalAccessToken(token);

      expect(rehash).toEqual(tokenHash);
    });

    it('should generate tokenPrefix from token', () => {
      const result = generatePersonalAccessToken();

      expect(result.tokenPrefix).toEqual(result.token.substring(0, 12));
    });
  });

  describe('validatePersonalAccessToken', () => {
    it('should return invalid for non-existent token', async () => {
      const result = await validatePersonalAccessToken(con, 'invalid_token');

      expect(result.valid).toBe(false);
      expect(result.userId).toBeUndefined();
    });

    it('should return valid for existing active token', async () => {
      const { token, tokenHash, tokenPrefix } = generatePersonalAccessToken();
      const tokenId = uuidv4();

      await con.getRepository(PersonalAccessToken).save({
        id: tokenId,
        userId: '1',
        name: 'Test Token',
        tokenHash,
        tokenPrefix,
      });

      const result = await validatePersonalAccessToken(con, token);

      expect(result.valid).toBe(true);
      expect(result.userId).toEqual('1');
      expect(result.tokenId).toEqual(tokenId);
    });

    it('should return invalid for revoked token', async () => {
      const { token, tokenHash, tokenPrefix } = generatePersonalAccessToken();

      await con.getRepository(PersonalAccessToken).save({
        id: uuidv4(),
        userId: '1',
        name: 'Test Token',
        tokenHash,
        tokenPrefix,
        revokedAt: new Date(),
      });

      const result = await validatePersonalAccessToken(con, token);

      expect(result.valid).toBe(false);
    });

    it('should return invalid for expired token', async () => {
      const { token, tokenHash, tokenPrefix } = generatePersonalAccessToken();

      await con.getRepository(PersonalAccessToken).save({
        id: uuidv4(),
        userId: '1',
        name: 'Test Token',
        tokenHash,
        tokenPrefix,
        expiresAt: new Date(Date.now() - 1000),
      });

      const result = await validatePersonalAccessToken(con, token);

      expect(result.valid).toBe(false);
    });

    it('should return valid for token with future expiration', async () => {
      const { token, tokenHash, tokenPrefix } = generatePersonalAccessToken();

      await con.getRepository(PersonalAccessToken).save({
        id: uuidv4(),
        userId: '1',
        name: 'Test Token',
        tokenHash,
        tokenPrefix,
        expiresAt: new Date(Date.now() + 86400000),
      });

      const result = await validatePersonalAccessToken(con, token);

      expect(result.valid).toBe(true);
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all active tokens for user', async () => {
      const token1 = generatePersonalAccessToken();
      const token2 = generatePersonalAccessToken();

      await con.getRepository(PersonalAccessToken).save([
        {
          id: uuidv4(),
          userId: '1',
          name: 'Token 1',
          tokenHash: token1.tokenHash,
          tokenPrefix: token1.tokenPrefix,
        },
        {
          id: uuidv4(),
          userId: '1',
          name: 'Token 2',
          tokenHash: token2.tokenHash,
          tokenPrefix: token2.tokenPrefix,
        },
      ]);

      await revokeAllUserTokens(con, '1');

      const result1 = await validatePersonalAccessToken(con, token1.token);
      const result2 = await validatePersonalAccessToken(con, token2.token);

      expect(result1.valid).toBe(false);
      expect(result2.valid).toBe(false);
    });

    it('should not affect other users tokens', async () => {
      const token1 = generatePersonalAccessToken();
      const token2 = generatePersonalAccessToken();

      await con.getRepository(PersonalAccessToken).save([
        {
          id: uuidv4(),
          userId: '1',
          name: 'Token 1',
          tokenHash: token1.tokenHash,
          tokenPrefix: token1.tokenPrefix,
        },
        {
          id: uuidv4(),
          userId: '2',
          name: 'Token 2',
          tokenHash: token2.tokenHash,
          tokenPrefix: token2.tokenPrefix,
        },
      ]);

      await revokeAllUserTokens(con, '1');

      const result1 = await validatePersonalAccessToken(con, token1.token);
      const result2 = await validatePersonalAccessToken(con, token2.token);

      expect(result1.valid).toBe(false);
      expect(result2.valid).toBe(true);
    });
  });
});

describe('personal access token GraphQL', () => {
  beforeEach(async () => {
    await saveFixtures(con, User, usersFixture);
    await saveFixtures(con, User, plusUsersFixture);
  });

  describe('query personalAccessTokens', () => {
    const QUERY = `
      query {
        personalAccessTokens {
          id
          name
          tokenPrefix
          createdAt
          expiresAt
          lastUsedAt
        }
      }
    `;

    it('should require authentication', async () => {
      await testQueryErrorCode(client, { query: QUERY }, 'UNAUTHENTICATED');
    });

    it('should return empty list when no tokens exist', async () => {
      loggedUser = '1';
      isPlus = false;

      const res = await client.query(QUERY);

      expect(res.errors).toBeFalsy();
      expect(res.data.personalAccessTokens).toEqual([]);
    });

    it('should return user tokens ordered by creation date', async () => {
      loggedUser = '1';
      isPlus = false;

      const token1 = generatePersonalAccessToken();
      const token2 = generatePersonalAccessToken();

      await con.getRepository(PersonalAccessToken).save([
        {
          id: uuidv4(),
          userId: '1',
          name: 'First Token',
          tokenHash: token1.tokenHash,
          tokenPrefix: token1.tokenPrefix,
          createdAt: new Date('2024-01-01'),
        },
        {
          id: uuidv4(),
          userId: '1',
          name: 'Second Token',
          tokenHash: token2.tokenHash,
          tokenPrefix: token2.tokenPrefix,
          createdAt: new Date('2024-01-02'),
        },
      ]);

      const res = await client.query(QUERY);

      expect(res.errors).toBeFalsy();
      expect(res.data.personalAccessTokens).toHaveLength(2);
      expect(res.data.personalAccessTokens[0].name).toEqual('Second Token');
      expect(res.data.personalAccessTokens[1].name).toEqual('First Token');
    });

    it('should not return revoked tokens', async () => {
      loggedUser = '1';
      isPlus = false;

      const token1 = generatePersonalAccessToken();
      const token2 = generatePersonalAccessToken();

      await con.getRepository(PersonalAccessToken).save([
        {
          id: uuidv4(),
          userId: '1',
          name: 'Active Token',
          tokenHash: token1.tokenHash,
          tokenPrefix: token1.tokenPrefix,
        },
        {
          id: uuidv4(),
          userId: '1',
          name: 'Revoked Token',
          tokenHash: token2.tokenHash,
          tokenPrefix: token2.tokenPrefix,
          revokedAt: new Date(),
        },
      ]);

      const res = await client.query(QUERY);

      expect(res.errors).toBeFalsy();
      expect(res.data.personalAccessTokens).toHaveLength(1);
      expect(res.data.personalAccessTokens[0].name).toEqual('Active Token');
    });

    it('should not return other users tokens', async () => {
      loggedUser = '1';
      isPlus = false;

      const token1 = generatePersonalAccessToken();
      const token2 = generatePersonalAccessToken();

      await con.getRepository(PersonalAccessToken).save([
        {
          id: uuidv4(),
          userId: '1',
          name: 'My Token',
          tokenHash: token1.tokenHash,
          tokenPrefix: token1.tokenPrefix,
        },
        {
          id: uuidv4(),
          userId: '2',
          name: 'Other User Token',
          tokenHash: token2.tokenHash,
          tokenPrefix: token2.tokenPrefix,
        },
      ]);

      const res = await client.query(QUERY);

      expect(res.errors).toBeFalsy();
      expect(res.data.personalAccessTokens).toHaveLength(1);
      expect(res.data.personalAccessTokens[0].name).toEqual('My Token');
    });
  });

  describe('mutation createPersonalAccessToken', () => {
    const MUTATION = (name: string, expiresInDays?: number) => `
      mutation {
        createPersonalAccessToken(input: {
          name: "${name}"
          ${expiresInDays ? `expiresInDays: ${expiresInDays}` : ''}
        }) {
          id
          name
          token
          tokenPrefix
          createdAt
          expiresAt
        }
      }
    `;

    it('should require authentication', async () => {
      await testMutationErrorCode(
        client,
        { mutation: MUTATION('Test Token') },
        'UNAUTHENTICATED',
      );
    });

    it('should require Plus subscription', async () => {
      loggedUser = '1';
      isPlus = false;

      await testMutationErrorCode(
        client,
        { mutation: MUTATION('Test Token') },
        'FORBIDDEN',
      );
    });

    it('should create token for Plus user', async () => {
      loggedUser = '5';
      isPlus = true;

      const res = await client.mutate(MUTATION('My API Token'));

      expect(res.errors).toBeFalsy();
      expect(res.data.createPersonalAccessToken.id).toBeTruthy();
      expect(res.data.createPersonalAccessToken.name).toEqual('My API Token');
      expect(res.data.createPersonalAccessToken.token).toMatch(
        new RegExp(`^${PERSONAL_ACCESS_TOKEN_PREFIX}`),
      );
      expect(res.data.createPersonalAccessToken.tokenPrefix).toBeTruthy();
      expect(res.data.createPersonalAccessToken.createdAt).toBeTruthy();
      expect(res.data.createPersonalAccessToken.expiresAt).toBeNull();
    });

    it('should create token with expiration', async () => {
      loggedUser = '5';
      isPlus = true;

      const res = await client.mutate(MUTATION('Expiring Token', 30));

      expect(res.errors).toBeFalsy();
      expect(res.data.createPersonalAccessToken.expiresAt).toBeTruthy();

      const expiresAt = new Date(res.data.createPersonalAccessToken.expiresAt);
      const expectedExpiration = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      );

      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(
        Math.abs(expiresAt.getTime() - expectedExpiration.getTime()),
      ).toBeLessThan(60000);
    });

    it('should enforce maximum token limit', async () => {
      loggedUser = '5';
      isPlus = true;

      for (let i = 0; i < MAX_PERSONAL_ACCESS_TOKENS_PER_USER; i++) {
        const generated = generatePersonalAccessToken();
        await con.getRepository(PersonalAccessToken).save({
          id: uuidv4(),
          userId: '5',
          name: `Token ${i}`,
          tokenHash: generated.tokenHash,
          tokenPrefix: generated.tokenPrefix,
        });
      }

      await testMutationErrorCode(
        client,
        { mutation: MUTATION('One Too Many') },
        'GRAPHQL_VALIDATION_FAILED',
      );
    });

    it('should allow creating new token after revoking one', async () => {
      loggedUser = '5';
      isPlus = true;

      for (let i = 0; i < MAX_PERSONAL_ACCESS_TOKENS_PER_USER; i++) {
        const generated = generatePersonalAccessToken();
        await con.getRepository(PersonalAccessToken).save({
          id: uuidv4(),
          userId: '5',
          name: `Token ${i}`,
          tokenHash: generated.tokenHash,
          tokenPrefix: generated.tokenPrefix,
          revokedAt: i === 0 ? new Date() : null,
        });
      }

      const res = await client.mutate(MUTATION('New Token'));

      expect(res.errors).toBeFalsy();
      expect(res.data.createPersonalAccessToken.name).toEqual('New Token');
    });

    it('should validate token name is not empty', async () => {
      loggedUser = '5';
      isPlus = true;

      await testMutationErrorCode(
        client,
        { mutation: MUTATION('') },
        'ZOD_VALIDATION_ERROR',
      );
    });
  });

  describe('mutation revokePersonalAccessToken', () => {
    const MUTATION = (id: string) => `
      mutation {
        revokePersonalAccessToken(id: "${id}") {
          _
        }
      }
    `;

    it('should require authentication', async () => {
      await testMutationErrorCode(
        client,
        { mutation: MUTATION(uuidv4()) },
        'UNAUTHENTICATED',
      );
    });

    it('should revoke own token', async () => {
      loggedUser = '1';
      isPlus = false;

      const generated = generatePersonalAccessToken();
      const tokenId = uuidv4();

      await con.getRepository(PersonalAccessToken).save({
        id: tokenId,
        userId: '1',
        name: 'My Token',
        tokenHash: generated.tokenHash,
        tokenPrefix: generated.tokenPrefix,
      });

      const res = await client.mutate(MUTATION(tokenId));

      expect(res.errors).toBeFalsy();

      const token = await con
        .getRepository(PersonalAccessToken)
        .findOneBy({ id: tokenId });
      expect(token?.revokedAt).toBeTruthy();
    });

    it('should not revoke other users token', async () => {
      loggedUser = '1';
      isPlus = false;

      const generated = generatePersonalAccessToken();
      const tokenId = uuidv4();

      await con.getRepository(PersonalAccessToken).save({
        id: tokenId,
        userId: '2',
        name: 'Other User Token',
        tokenHash: generated.tokenHash,
        tokenPrefix: generated.tokenPrefix,
      });

      await testMutationErrorCode(
        client,
        { mutation: MUTATION(tokenId) },
        'GRAPHQL_VALIDATION_FAILED',
      );

      const token = await con
        .getRepository(PersonalAccessToken)
        .findOneBy({ id: tokenId });
      expect(token?.revokedAt).toBeNull();
    });

    it('should error when revoking non-existent token', async () => {
      loggedUser = '1';
      isPlus = false;

      await testMutationErrorCode(
        client,
        { mutation: MUTATION(uuidv4()) },
        'GRAPHQL_VALIDATION_FAILED',
      );
    });

    it('should error when revoking already revoked token', async () => {
      loggedUser = '1';
      isPlus = false;

      const generated = generatePersonalAccessToken();
      const tokenId = uuidv4();

      await con.getRepository(PersonalAccessToken).save({
        id: tokenId,
        userId: '1',
        name: 'Already Revoked',
        tokenHash: generated.tokenHash,
        tokenPrefix: generated.tokenPrefix,
        revokedAt: new Date(),
      });

      await testMutationErrorCode(
        client,
        { mutation: MUTATION(tokenId) },
        'GRAPHQL_VALIDATION_FAILED',
      );
    });
  });
});
