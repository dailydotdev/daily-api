import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import {
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  type GraphQLTestingState,
  type GraphQLTestClient,
  testMutationErrorCode,
  createMockNjordTransport,
  createMockNjordErrorTransport,
} from './helpers';
import {
  ArticlePost,
  Comment,
  PostType,
  Source,
  User,
  UserPost,
} from '../src/entity';
import { sourcesFixture, usersFixture } from './fixture';

import { FastifyInstance } from 'fastify';
import appFunc from '../src';
import { Product, ProductType } from '../src/entity/Product';
import type { AuthContext, Context } from '../src/Context';
import { createClient } from '@connectrpc/connect';
import { Credits, TransferStatus } from '@dailydotdev/schema';
import * as njordCommon from '../src/common/njord';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
} from '../src/entity/user/UserTransaction';
import { ghostUser } from '../src/common';
import { UserComment } from '../src/entity/user/UserComment';
import { CoresRole } from '../src/types';

const mockTransport = createMockNjordTransport();

let app: FastifyInstance;
let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string | null = null;

beforeAll(async () => {
  con = await createOrGetConnection();
  app = await appFunc();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser) as Context,
  );
  client = state.client;
  return app.ready();
});

beforeEach(() => {
  loggedUser = null;
});

describe('award user mutation', () => {
  const MUTATION = `
  mutation award($productId: ID!, $entityId: ID!, $note: String) {
    award(productId: $productId, type: USER, entityId: $entityId, note: $note) {
      transactionId
      balance {
        amount
      }
    }
  }
`;

  beforeEach(async () => {
    jest.resetAllMocks();

    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => {
        return {
          ...item,
          id: `t-awum-${item.id}`,
          username: `t-awum-${item.username}`,
          github: undefined,
          coresRole: CoresRole.Creator,
        };
      }),
    );

    await saveFixtures(con, Product, [
      {
        id: 'dd65570f-86c0-40a0-b8a0-3fdbd0d3945d',
        name: 'Award 1',
        image: 'https://daily.dev/award.jpg',
        type: ProductType.Award,
        value: 42,
      },
      {
        id: '7ef73a97-ced5-4c7d-945b-6e0519bf3d39',
        name: 'Award 2',
        image: 'https://daily.dev/award.jpg',
        type: ProductType.Award,
        value: 10,
      },
      {
        id: '96423e6d-3d29-49de-9f86-d93124460018',
        name: 'Award 3',
        image: 'https://daily.dev/award.jpg',
        type: ProductType.Award,
        value: 20,
      },
    ]);
  });

  it('should not authorize when not logged in', async () => {
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          productId: 'dd65570f-86c0-40a0-b8a0-3fdbd0d3945d',
          entityId: 't-awum-2',
          note: 'Test test!',
        },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should throw if awarding yourself', async () => {
    loggedUser = 't-awum-2';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          productId: 'dd65570f-86c0-40a0-b8a0-3fdbd0d3945d',
          entityId: 't-awum-2',
          note: 'Test test!',
        },
      },
      'FORBIDDEN',
    );
  });

  it('should throw if awarding special user', async () => {
    loggedUser = 't-awum-2';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          productId: 'dd65570f-86c0-40a0-b8a0-3fdbd0d3945d',
          entityId: ghostUser.id,
          note: 'Test test!',
        },
      },
      'FORBIDDEN',
    );
  });

  it('should award user', async () => {
    loggedUser = 't-awum-1';

    jest
      .spyOn(njordCommon, 'getNjordClient')
      .mockImplementation(() => createClient(Credits, mockTransport));

    const res = await client.mutate(MUTATION, {
      variables: {
        productId: 'dd65570f-86c0-40a0-b8a0-3fdbd0d3945d',
        entityId: 't-awum-2',
        note: 'Test test!',
      },
    });
    expect(res.errors).toBeUndefined();

    expect(res.data).toEqual({
      award: {
        transactionId: expect.any(String),
        balance: { amount: expect.any(Number) },
      },
    });
  });

  it('should not award when user does not have access to cores', async () => {
    loggedUser = 't-awum-2';

    await con.getRepository(User).update(
      { id: 't-awum-2' },
      {
        coresRole: CoresRole.None,
      },
    );

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          productId: 'dd65570f-86c0-40a0-b8a0-3fdbd0d3945d',
          entityId: 't-awum-1',
          note: 'Test test!',
        },
      },
      'FORBIDDEN',
      'You can not award yet',
    );
  });

  it('should not award user that is not a creator', async () => {
    loggedUser = 't-awum-2';

    await con.getRepository(User).update(
      { id: 't-awum-1' },
      {
        coresRole: CoresRole.User,
      },
    );

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          productId: 'dd65570f-86c0-40a0-b8a0-3fdbd0d3945d',
          entityId: 't-awum-1',
          note: 'Test test!',
        },
      },
      'FORBIDDEN',
      'You can not award this user',
    );
  });

  it('should not award user when njord error', async () => {
    loggedUser = 't-awum-1';

    jest.spyOn(njordCommon, 'getNjordClient').mockImplementation(() =>
      createClient(
        Credits,
        createMockNjordErrorTransport({
          errorStatus: TransferStatus.INSUFFICIENT_FUNDS,
          errorMessage: 'Insufficient funds',
        }),
      ),
    );

    const res = await client.mutate(MUTATION, {
      variables: {
        productId: 'dd65570f-86c0-40a0-b8a0-3fdbd0d3945d',
        entityId: 't-awum-2',
        note: 'Test test!',
      },
    });
    expect(res.errors).toBeTruthy();

    expect(res.errors).toMatchObject([
      {
        extensions: {
          balance: { amount: 0 },
          code: 'BALANCE_TRANSACTION_ERROR',
          status: 1,
          transactionId: expect.any(String),
        },
        message: 'Insufficient Cores balance.',
      },
    ]);

    const transactionId = res.errors![0].extensions.transactionId as string;

    const transaction = await con.getRepository(UserTransaction).findOneBy({
      id: transactionId,
    });

    expect(transaction).not.toBeNull();
    expect(transaction!.id).toBe(transactionId);
    expect(transaction!.status).toBe(UserTransactionStatus.InsufficientFunds);
  });
});

describe('award post mutation', () => {
  const MUTATION = `
  mutation award($productId: ID!, $entityId: ID!, $note: String) {
    award(productId: $productId, type: POST, entityId: $entityId, note: $note) {
      transactionId
      balance {
        amount
      }
    }
  }
`;

  beforeEach(async () => {
    jest.resetAllMocks();

    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => {
        return {
          ...item,
          id: `t-awpm-${item.id}`,
          username: `t-awpm-${item.username}`,
          github: undefined,
          coresRole: CoresRole.Creator,
        };
      }),
    );

    await saveFixtures(
      con,
      Source,
      sourcesFixture.map((item) => {
        return {
          ...item,
          id: `s-awpm-${item.id}`,
          handle: `s-awpm-${item.handle}`,
          name: `S-AWPM-${item.name}`,
        };
      }),
    );

    await saveFixtures(con, ArticlePost, [
      {
        id: 'p-awpm-1',
        shortId: 'sp-awpm-1',
        title: 'P-AWPM-1',
        url: 'http://p-awpm-1.com',
        canonicalUrl: 'http://p-awpm-1-c.com',
        image: 'https://daily.dev/image.jpg',
        score: 1,
        sourceId: 's-awpm-a',
        createdAt: new Date(),
        tagsStr: 'javascript,webdev',
        type: PostType.Article,
        contentCuration: ['c1', 'c2'],
        authorId: 't-awpm-2',
        awards: 0,
      },
      {
        id: 'p-awpm-no-author',
        shortId: 'sp-awpm-na',
        title: 'P-AWPM-NO-AUTHOR',
        url: 'http://p-awpm-na.com',
        canonicalUrl: 'http://p-awpm-na-c.com',
        image: 'https://daily.dev/image.jpg',
        score: 1,
        sourceId: 's-awpm-a',
        createdAt: new Date(),
        tagsStr: 'javascript,webdev',
        type: PostType.Article,
        contentCuration: ['c1', 'c2'],
        awards: 0,
      },
      {
        id: 'p-awpm-special-user',
        shortId: 'sp-awpm-spu',
        title: 'P-AWPM-NO-AUTHOR',
        url: 'http://p-awpm-spu.com',
        canonicalUrl: 'http://p-awpm-spu-c.com',
        image: 'https://daily.dev/image.jpg',
        score: 1,
        sourceId: 's-awpm-a',
        createdAt: new Date(),
        tagsStr: 'javascript,webdev',
        type: PostType.Article,
        contentCuration: ['c1', 'c2'],
        awards: 0,
        authorId: ghostUser.id,
      },
    ]);

    await saveFixtures(con, Product, [
      {
        id: 'dd65570f-86c0-40a0-b8a0-3fdbd0d3945d',
        name: 'Award 1',
        image: 'https://daily.dev/award.jpg',
        type: ProductType.Award,
        value: 42,
      },
      {
        id: '7ef73a97-ced5-4c7d-945b-6e0519bf3d39',
        name: 'Award 2',
        image: 'https://daily.dev/award.jpg',
        type: ProductType.Award,
        value: 10,
      },
      {
        id: '96423e6d-3d29-49de-9f86-d93124460018',
        name: 'Award 3',
        image: 'https://daily.dev/award.jpg',
        type: ProductType.Award,
        value: 20,
      },
    ]);

    jest
      .spyOn(njordCommon, 'getNjordClient')
      .mockImplementation(() => createClient(Credits, mockTransport));
  });

  it('should not authorize when not logged in', async () => {
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          productId: 'dd65570f-86c0-40a0-b8a0-3fdbd0d3945d',
          entityId: 'p-awpm-1',
          note: 'Test test!',
        },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should throw if awarding yourself', async () => {
    loggedUser = 't-awpm-2';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          productId: 'dd65570f-86c0-40a0-b8a0-3fdbd0d3945d',
          entityId: 'p-awpm-1',
          note: 'Test test!',
        },
      },
      'FORBIDDEN',
    );
  });

  it('should throw if awarding special user', async () => {
    loggedUser = 't-awpm-2';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          productId: 'dd65570f-86c0-40a0-b8a0-3fdbd0d3945d',
          entityId: 'p-awpm-special-user',
          note: 'Test test!',
        },
      },
      'FORBIDDEN',
    );
  });

  it('should throw if no product', async () => {
    loggedUser = 't-awpm-1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          productId: 'd6129095-38cc-468e-aed9-7884fc07c349',
          entityId: 'p-awpm-1',
          note: 'Test test!',
        },
      },
      'NOT_FOUND',
    );
  });

  it('should throw if no post', async () => {
    loggedUser = 't-awpm-1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          productId: 'dd65570f-86c0-40a0-b8a0-3fdbd0d3945d',
          entityId: 'does-not-exist',
          note: 'Test test!',
        },
      },
      'NOT_FOUND',
    );
  });

  it('should throw conflict if post without author', async () => {
    loggedUser = 't-awpm-1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          productId: 'dd65570f-86c0-40a0-b8a0-3fdbd0d3945d',
          entityId: 'p-awpm-no-author',
          note: 'Test test!',
        },
      },
      'CONFLICT',
    );
  });

  it('should throw if post already rewarded', async () => {
    const transaction = await njordCommon.createTransaction({
      ctx: {
        userId: 't-awpm-1',
      } as AuthContext,
      entityManager: con.getRepository(Product).manager,
      productId: 'dd65570f-86c0-40a0-b8a0-3fdbd0d3945d',
      receiverId: 't-awpm-2',
      note: 'Test test!',
    });

    await con.getRepository(UserPost).save({
      userId: 't-awpm-1',
      postId: 'p-awpm-1',
      awardTransactionId: transaction.id,
    });

    loggedUser = 't-awpm-1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          productId: 'dd65570f-86c0-40a0-b8a0-3fdbd0d3945d',
          entityId: 'p-awpm-1',
          note: 'Test test!',
        },
      },
      'CONFLICT',
    );
  });

  it('should award post', async () => {
    loggedUser = 't-awpm-1';

    const res = await client.mutate(MUTATION, {
      variables: {
        productId: 'dd65570f-86c0-40a0-b8a0-3fdbd0d3945d',
        entityId: 'p-awpm-1',
        note: 'Test test!',
      },
    });
    expect(res.errors).toBeUndefined();

    expect(res.data).toEqual({
      award: {
        transactionId: expect.any(String),
        balance: { amount: expect.any(Number) },
      },
    });

    const { transactionId } = res.data.award;

    const userPost = await con.getRepository(UserPost).findOneOrFail({
      where: {
        userId: 't-awpm-1',
        postId: 'p-awpm-1',
      },
    });

    expect(userPost.awardTransactionId).toBe(transactionId);
    expect(userPost.flags.awardId).toBe('dd65570f-86c0-40a0-b8a0-3fdbd0d3945d');

    const comment = await con.getRepository(Comment).findOneOrFail({
      where: {
        userId: loggedUser,
      },
    });
    expect(comment.awardTransactionId).toBe(transactionId);
    expect(comment.content).toBe('Test test!');

    const transaction = await con.getRepository(UserTransaction).findOneOrFail({
      where: {
        id: transactionId,
      },
    });

    expect(transaction.productId).toBe('dd65570f-86c0-40a0-b8a0-3fdbd0d3945d');

    const post = await con.getRepository(ArticlePost).findOneOrFail({
      where: {
        id: 'p-awpm-1',
      },
    });

    expect(post.awards).toBe(1);
  });

  it('should not award when user does not have access to cores', async () => {
    loggedUser = 't-awpm-2';

    await con.getRepository(User).update(
      { id: 't-awpm-2' },
      {
        coresRole: CoresRole.None,
      },
    );

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          productId: 'dd65570f-86c0-40a0-b8a0-3fdbd0d3945d',
          entityId: 'p-awpm-1',
          note: 'Test test!',
        },
      },
      'FORBIDDEN',
      'You can not award yet',
    );
  });

  it('should not award post of user that is not a creator', async () => {
    loggedUser = 't-awpm-1';

    await con.getRepository(User).update(
      { id: 't-awpm-2' },
      {
        coresRole: CoresRole.User,
      },
    );

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          productId: 'dd65570f-86c0-40a0-b8a0-3fdbd0d3945d',
          entityId: 'p-awpm-1',
          note: 'Test test!',
        },
      },
      'FORBIDDEN',
      'You can not award this user',
    );
  });

  it('should not award post when njord error', async () => {
    loggedUser = 't-awpm-1';

    jest.spyOn(njordCommon, 'getNjordClient').mockImplementation(() =>
      createClient(
        Credits,
        createMockNjordErrorTransport({
          errorStatus: TransferStatus.INSUFFICIENT_FUNDS,
          errorMessage: 'Insufficient funds',
        }),
      ),
    );

    const res = await client.mutate(MUTATION, {
      variables: {
        productId: 'dd65570f-86c0-40a0-b8a0-3fdbd0d3945d',
        entityId: 'p-awpm-1',
        note: 'Test test!',
      },
    });

    expect(res.errors).toBeTruthy();

    expect(res.errors).toMatchObject([
      {
        extensions: {
          balance: { amount: 0 },
          code: 'BALANCE_TRANSACTION_ERROR',
          status: 1,
          transactionId: expect.any(String),
        },
        message: 'Insufficient Cores balance.',
      },
    ]);

    const transactionId = res.errors![0].extensions.transactionId as string;

    const transaction = await con.getRepository(UserTransaction).findOneBy({
      id: transactionId,
    });

    expect(transaction).not.toBeNull();
    expect(transaction!.id).toBe(transactionId);
    expect(transaction!.status).toBe(UserTransactionStatus.InsufficientFunds);
    expect(transaction!.productId).toBe('dd65570f-86c0-40a0-b8a0-3fdbd0d3945d');

    const userPost = await con.getRepository(UserPost).findOne({
      where: {
        awardTransactionId: transactionId,
      },
    });

    expect(userPost).toBeNull();

    const post = await con.getRepository(ArticlePost).findOneOrFail({
      where: {
        id: 'p-awpm-1',
      },
    });

    expect(post.awards).toBe(0);
  });
});

describe('query products', () => {
  const QUERY = `
  query {
    products {
      edges {
        node {
          id
          name
          value
          flags {
            description
          }
        }
      }
    }
  }
`;

  beforeEach(async () => {
    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => {
        return {
          ...item,
          id: `t-pq-${item.id}`,
          username: `t-pq-${item.username}`,
          github: undefined,
        };
      }),
    );

    await saveFixtures(con, Product, [
      {
        id: 'a617586b-6d46-4f54-9b67-edc91b79b279',
        name: 'Award 1',
        image: 'https://daily.dev/award.jpg',
        type: ProductType.Award,
        value: 42,
        flags: {
          description: 'meaning of life?',
        },
      },
      {
        id: 'c7f0bc48-3e79-46cb-8bef-140a037271c6',
        name: 'Award 2',
        image: 'https://daily.dev/award.jpg',
        type: ProductType.Award,
        value: 10,
      },
      {
        id: '90a8f2a4-d76e-488c-9935-baed96fac7a0',
        name: 'Award 3',
        image: 'https://daily.dev/award.jpg',
        type: ProductType.Award,
        value: 20,
      },
    ]);
  });

  it('should return products sorted by value', async () => {
    loggedUser = 't-awpm-1';

    const res = await client.query(QUERY);

    expect(res.errors).toBeFalsy();

    expect(res.data.products).toMatchObject({
      edges: [
        {
          node: {
            id: 'c7f0bc48-3e79-46cb-8bef-140a037271c6',
            name: 'Award 2',
            value: 10,
          },
        },
        {
          node: {
            id: '90a8f2a4-d76e-488c-9935-baed96fac7a0',
            name: 'Award 3',
            value: 20,
          },
        },
        {
          node: {
            id: 'a617586b-6d46-4f54-9b67-edc91b79b279',
            name: 'Award 1',
            value: 42,
            flags: {
              description: 'meaning of life?',
            },
          },
        },
      ],
    });
  });
});

describe('award comment mutation', () => {
  const MUTATION = `
  mutation award($productId: ID!, $entityId: ID!, $note: String) {
    award(productId: $productId, type: COMMENT, entityId: $entityId, note: $note) {
      transactionId
      balance {
        amount
      }
    }
  }
`;

  beforeEach(async () => {
    jest.resetAllMocks();

    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => {
        return {
          ...item,
          id: `t-awcm-${item.id}`,
          username: `t-awcm-${item.username}`,
          github: undefined,
          coresRole: CoresRole.Creator,
        };
      }),
    );

    await saveFixtures(
      con,
      Source,
      sourcesFixture.map((item) => {
        return {
          ...item,
          id: `s-awcm-${item.id}`,
          handle: `s-awcm-${item.handle}`,
          name: `S-awcm-${item.name}`,
        };
      }),
    );

    await saveFixtures(con, ArticlePost, [
      {
        id: 'p-awcm-1',
        shortId: 'sp-awcm-1',
        title: 'P-awcm-1',
        url: 'http://p-awcm-1.com',
        canonicalUrl: 'http://p-awcm-1-c.com',
        image: 'https://daily.dev/image.jpg',
        score: 1,
        sourceId: 's-awcm-a',
        createdAt: new Date(),
        tagsStr: 'javascript,webdev',
        type: PostType.Article,
        contentCuration: ['c1', 'c2'],
        authorId: 't-awcm-2',
        awards: 0,
      },
    ]);

    await saveFixtures(con, Comment, [
      {
        id: 'c-awcm-1',
        postId: 'p-awcm-1',
        userId: 't-awcm-2',
        content: 'Test comment',
        createdAt: new Date(),
      },
      {
        id: 'c-awcm-2-spu',
        postId: 'p-awcm-1',
        userId: ghostUser.id,
        content: 'Test comment',
        createdAt: new Date(),
      },
      {
        id: 'c-awcm-3',
        parentId: 'c-awcm-1',
        postId: 'p-awcm-1',
        userId: 't-awcm-2',
        content: 'Test sub comment',
        createdAt: new Date(),
      },
    ]);

    await saveFixtures(con, Product, [
      {
        id: '17380714-1a0c-4dfc-b435-1ff44be8558d',
        name: 'Award 1',
        image: 'https://daily.dev/award.jpg',
        type: ProductType.Award,
        value: 42,
      },
      {
        id: '238669af-2102-4a8a-8002-4dfff2cf71b6',
        name: 'Award 2',
        image: 'https://daily.dev/award.jpg',
        type: ProductType.Award,
        value: 10,
      },
      {
        id: 'c2fdf38b-67df-40c4-85e8-c44e253e7d40',
        name: 'Award 3',
        image: 'https://daily.dev/award.jpg',
        type: ProductType.Award,
        value: 20,
      },
    ]);

    jest
      .spyOn(njordCommon, 'getNjordClient')
      .mockImplementation(() => createClient(Credits, mockTransport));
  });

  it('should not authorize when not logged in', async () => {
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          productId: '17380714-1a0c-4dfc-b435-1ff44be8558d',
          entityId: 'c-awcm-1',
          note: 'Test test!',
        },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should throw if awarding yourself', async () => {
    loggedUser = 't-awcm-2';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          productId: '17380714-1a0c-4dfc-b435-1ff44be8558d',
          entityId: 'c-awcm-1',
          note: 'Test test!',
        },
      },
      'FORBIDDEN',
    );
  });

  it('should throw if awarding special user', async () => {
    loggedUser = 't-awcm-2';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          productId: '17380714-1a0c-4dfc-b435-1ff44be8558d',
          entityId: 'c-awcm-2-spu',
          note: 'Test test!',
        },
      },
      'FORBIDDEN',
    );
  });

  it('should throw if no product', async () => {
    loggedUser = 't-awcm-1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          productId: 'd6129095-38cc-468e-aed9-7884fc07c349',
          entityId: 'c-awcm-1',
          note: 'Test test!',
        },
      },
      'NOT_FOUND',
    );
  });

  it('should throw if no comment', async () => {
    loggedUser = 't-awcm-1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          productId: '17380714-1a0c-4dfc-b435-1ff44be8558d',
          entityId: 'does-not-exist',
          note: 'Test test!',
        },
      },
      'NOT_FOUND',
    );
  });

  it('should throw if comment already rewarded', async () => {
    const transaction = await njordCommon.createTransaction({
      ctx: {
        userId: 't-awcm-1',
      } as AuthContext,
      entityManager: con.getRepository(Product).manager,
      productId: '17380714-1a0c-4dfc-b435-1ff44be8558d',
      receiverId: 't-awcm-2',
      note: 'Test test!',
    });

    await con.getRepository(UserComment).save({
      userId: 't-awcm-1',
      commentId: 'c-awcm-1',
      awardTransactionId: transaction.id,
    });

    loggedUser = 't-awcm-1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          productId: '17380714-1a0c-4dfc-b435-1ff44be8558d',
          entityId: 'c-awcm-1',
          note: 'Test test!',
        },
      },
      'CONFLICT',
    );
  });

  it('should award comment', async () => {
    loggedUser = 't-awcm-1';

    const res = await client.mutate(MUTATION, {
      variables: {
        productId: '17380714-1a0c-4dfc-b435-1ff44be8558d',
        entityId: 'c-awcm-1',
        note: 'Test test!',
      },
    });
    expect(res.errors).toBeUndefined();

    expect(res.data).toEqual({
      award: {
        transactionId: expect.any(String),
        balance: { amount: expect.any(Number) },
      },
    });

    const { transactionId } = res.data.award;

    const userComment = await con.getRepository(UserComment).findOneOrFail({
      where: {
        userId: 't-awcm-1',
        commentId: 'c-awcm-1',
      },
    });

    expect(userComment.awardTransactionId).toBe(transactionId);
    expect(userComment.flags.awardId).toBe(
      '17380714-1a0c-4dfc-b435-1ff44be8558d',
    );

    const transaction = await con.getRepository(UserTransaction).findOneOrFail({
      where: {
        id: transactionId,
      },
    });

    expect(transaction.productId).toBe('17380714-1a0c-4dfc-b435-1ff44be8558d');

    const awardComment = await con.getRepository(Comment).findOne({
      where: {
        userId: 't-awcm-1',
        awardTransactionId: transactionId,
      },
    });

    expect(awardComment).toBeTruthy();
    expect(awardComment!.content).toBe('Test test!');

    const comment = await con.getRepository(Comment).findOneOrFail({
      where: {
        id: 'c-awcm-1',
      },
    });

    expect(comment.awards).toBe(1);
  });

  it('should award nested comment', async () => {
    loggedUser = 't-awcm-1';

    const res = await client.mutate(MUTATION, {
      variables: {
        productId: '17380714-1a0c-4dfc-b435-1ff44be8558d',
        entityId: 'c-awcm-3',
        note: 'Test test!',
      },
    });
    expect(res.errors).toBeUndefined();

    expect(res.data).toEqual({
      award: {
        transactionId: expect.any(String),
        balance: { amount: expect.any(Number) },
      },
    });

    const { transactionId } = res.data.award;

    const userComment = await con.getRepository(UserComment).findOneOrFail({
      where: {
        userId: 't-awcm-1',
        commentId: 'c-awcm-3',
      },
    });

    expect(userComment.awardTransactionId).toBe(transactionId);
    expect(userComment.flags.awardId).toBe(
      '17380714-1a0c-4dfc-b435-1ff44be8558d',
    );

    const transaction = await con.getRepository(UserTransaction).findOneOrFail({
      where: {
        id: transactionId,
      },
    });

    expect(transaction.productId).toBe('17380714-1a0c-4dfc-b435-1ff44be8558d');

    const awardComment = await con.getRepository(Comment).findOne({
      where: {
        userId: 't-awcm-1',
        awardTransactionId: transactionId,
      },
    });

    expect(awardComment).toBeTruthy();
    expect(awardComment!.content).toBe('Test test!');
    expect(awardComment!.parentId).toBe('c-awcm-1');

    const comment = await con.getRepository(Comment).findOneOrFail({
      where: {
        id: 'c-awcm-3',
      },
    });

    expect(comment.awards).toBe(1);
  });

  it('should not award when user does not have access to cores', async () => {
    loggedUser = 't-awcm-2';

    await con.getRepository(User).update(
      { id: 't-awcm-2' },
      {
        coresRole: CoresRole.None,
      },
    );

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          productId: '17380714-1a0c-4dfc-b435-1ff44be8558d',
          entityId: 'c-awcm-3',
          note: 'Test test!',
        },
      },
      'FORBIDDEN',
      'You can not award yet',
    );
  });

  it('should not award comment of user that is not a creator', async () => {
    loggedUser = 't-awcm-1';

    await con.getRepository(User).update(
      { id: 't-awcm-2' },
      {
        coresRole: CoresRole.None,
      },
    );

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          productId: '17380714-1a0c-4dfc-b435-1ff44be8558d',
          entityId: 'c-awcm-3',
          note: 'Test test!',
        },
      },
      'FORBIDDEN',
      'You can not award this user',
    );
  });

  it('should not award comment when njord error', async () => {
    jest.spyOn(njordCommon, 'getNjordClient').mockImplementation(() =>
      createClient(
        Credits,
        createMockNjordErrorTransport({
          errorStatus: TransferStatus.INSUFFICIENT_FUNDS,
          errorMessage: 'Insufficient funds',
        }),
      ),
    );

    loggedUser = 't-awcm-1';

    const res = await client.mutate(MUTATION, {
      variables: {
        productId: '17380714-1a0c-4dfc-b435-1ff44be8558d',
        entityId: 'c-awcm-1',
        note: 'Test test!',
      },
    });
    expect(res.errors).toBeTruthy();

    expect(res.errors).toMatchObject([
      {
        extensions: {
          balance: { amount: 0 },
          code: 'BALANCE_TRANSACTION_ERROR',
          status: 1,
          transactionId: expect.any(String),
        },
        message: 'Insufficient Cores balance.',
      },
    ]);

    const transactionId = res.errors![0].extensions.transactionId as string;

    const transaction = await con.getRepository(UserTransaction).findOneBy({
      id: transactionId,
    });

    expect(transaction).not.toBeNull();
    expect(transaction!.id).toBe(transactionId);
    expect(transaction!.status).toBe(UserTransactionStatus.InsufficientFunds);
    expect(transaction!.productId).toBe('17380714-1a0c-4dfc-b435-1ff44be8558d');

    const userComment = await con.getRepository(UserComment).findOne({
      where: {
        awardTransactionId: transactionId,
      },
    });

    expect(userComment).toBeNull();

    const awardComment = await con.getRepository(Comment).findOne({
      where: {
        userId: 't-awcm-1',
        awardTransactionId: transactionId,
      },
    });

    expect(awardComment).toBeNull();

    const comment = await con.getRepository(Comment).findOneOrFail({
      where: {
        id: 'c-awcm-1',
      },
    });

    expect(comment.awards).toBe(0);
  });
});

describe('query list transactions', () => {
  const QUERY = `
  query {
    transactions {
      edges {
        node {
          id
          status
          receiver {
            id
          }
          sender {
            id
          }
          value
          valueIncFees
        }
      }
    }
  }
`;

  beforeEach(async () => {
    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => {
        return {
          ...item,
          id: `t-tq-${item.id}`,
          username: `t-pq-${item.username}`,
          github: undefined,
        };
      }),
    );

    const now = new Date();

    await saveFixtures(con, UserTransaction, [
      {
        id: 'ca902187-0978-4b33-85eb-4e1e08c8edf0',
        processor: UserTransactionProcessor.Njord,
        receiverId: 't-tq-1',
        status: UserTransactionStatus.Success,
        productId: null,
        senderId: 't-tq-2',
        fee: 5,
        value: 100,
        valueIncFees: 95,
        createdAt: new Date(now.getTime() - 3000),
      },
      {
        id: '0046f666-ed75-46be-a1d4-74157218a484',
        processor: UserTransactionProcessor.Njord,
        receiverId: 't-tq-1',
        status: UserTransactionStatus.Error,
        productId: null,
        senderId: 't-tq-2',
        fee: 10,
        value: 50,
        valueIncFees: 45,
        createdAt: new Date(now.getTime() - 2000),
      },
      {
        id: '15a0904d-51e0-4555-b531-ab6e3c99119f',
        processor: UserTransactionProcessor.Njord,
        receiverId: 't-tq-3',
        status: UserTransactionStatus.Success,
        productId: null,
        senderId: null,
        fee: 0,
        value: 350,
        valueIncFees: 350,
        createdAt: new Date(now.getTime() - 1000),
      },
      {
        id: '2dc94a5d-7bc4-464d-97d5-b4d1d4e41ce2',
        processor: UserTransactionProcessor.Njord,
        receiverId: 't-tq-1',
        status: UserTransactionStatus.Success,
        productId: null,
        senderId: null,
        fee: 0,
        value: 1200,
        valueIncFees: 1200,
        createdAt: new Date(now.getTime() - 1000),
      },
      {
        id: '637f848c-f593-4389-a53b-dec198661da4',
        processor: UserTransactionProcessor.Njord,
        receiverId: 't-tq-1',
        status: UserTransactionStatus.Created,
        productId: null,
        senderId: null,
        fee: 0,
        value: 1200,
        valueIncFees: 1200,
        createdAt: new Date(now.getTime() - 1000),
      },
    ]);
  });

  it('should not authorize when not logged in', async () => {
    await testMutationErrorCode(
      client,
      {
        mutation: QUERY,
      },
      'UNAUTHENTICATED',
    );
  });

  it('should return transactions sorted by createdAt', async () => {
    loggedUser = 't-tq-1';

    const res = await client.query(QUERY);

    expect(res.errors).toBeFalsy();

    expect(res.data.transactions).toMatchObject({
      edges: [
        {
          node: {
            id: '2dc94a5d-7bc4-464d-97d5-b4d1d4e41ce2',
            status: UserTransactionStatus.Success,
            receiver: { id: 't-tq-1' },
            sender: null,
            value: 1200,
            valueIncFees: 1200,
          },
        },
        {
          node: {
            id: '0046f666-ed75-46be-a1d4-74157218a484',
            status: UserTransactionStatus.Error,
            receiver: { id: 't-tq-1' },
            sender: { id: 't-tq-2' },
            value: 50,
            valueIncFees: 45,
          },
        },
        {
          node: {
            id: 'ca902187-0978-4b33-85eb-4e1e08c8edf0',
            status: UserTransactionStatus.Success,
            receiver: { id: 't-tq-1' },
            sender: { id: 't-tq-2' },
            value: 100,
            valueIncFees: 95,
          },
        },
      ],
    });
  });
});

describe('query transactionSummary', () => {
  const QUERY = `
  query {
    transactionSummary {
      purchased
      received
      spent
    }
  }
`;

  beforeEach(async () => {
    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => {
        return {
          ...item,
          id: `t-tsq-${item.id}`,
          username: `t-pq-${item.username}`,
          github: undefined,
        };
      }),
    );

    const now = new Date();

    await saveFixtures(con, Product, [
      {
        id: '2032fee4-4071-4a58-bcd6-4869083bd1d5',
        name: 'Award 1',
        image: 'https://daily.dev/award.jpg',
        type: ProductType.Award,
        value: 42,
      },
    ]);

    await saveFixtures(con, UserTransaction, [
      {
        processor: UserTransactionProcessor.Njord,
        receiverId: 't-tsq-1',
        status: UserTransactionStatus.Success,
        productId: '2032fee4-4071-4a58-bcd6-4869083bd1d5',
        senderId: 't-tsq-2',
        fee: 5,
        value: 100,
        valueIncFees: 95,
        createdAt: new Date(now.getTime() - 3000),
      },
      {
        processor: UserTransactionProcessor.Njord,
        receiverId: 't-tsq-1',
        status: UserTransactionStatus.Success,
        productId: '2032fee4-4071-4a58-bcd6-4869083bd1d5',
        senderId: 't-tsq-2',
        fee: 5,
        value: 200,
        valueIncFees: 190,
        createdAt: new Date(now.getTime() - 3000),
      },
      {
        processor: UserTransactionProcessor.Njord,
        receiverId: 't-tsq-2',
        status: UserTransactionStatus.Success,
        productId: '2032fee4-4071-4a58-bcd6-4869083bd1d5',
        senderId: 't-tsq-1',
        fee: 5,
        value: 200,
        valueIncFees: 190,
        createdAt: new Date(now.getTime() - 3000),
      },
      {
        processor: UserTransactionProcessor.Njord,
        receiverId: 't-tsq-2',
        status: UserTransactionStatus.Error,
        productId: '2032fee4-4071-4a58-bcd6-4869083bd1d5',
        senderId: 't-tsq-1',
        fee: 5,
        value: 200,
        valueIncFees: 200,
        createdAt: new Date(now.getTime() - 3000),
      },
      {
        processor: UserTransactionProcessor.Njord,
        receiverId: 't-tsq-1',
        status: UserTransactionStatus.Error,
        productId: '2032fee4-4071-4a58-bcd6-4869083bd1d5',
        senderId: 't-tsq-2',
        fee: 5,
        value: 50,
        valueIncFees: 50,
        createdAt: new Date(now.getTime() - 2000),
      },
      {
        processor: UserTransactionProcessor.Njord,
        receiverId: 't-tsq-3',
        status: UserTransactionStatus.Success,
        productId: null,
        senderId: null,
        fee: 0,
        value: 350,
        valueIncFees: 350,
        createdAt: new Date(now.getTime() - 1000),
      },
      {
        processor: UserTransactionProcessor.Njord,
        receiverId: 't-tsq-1',
        status: UserTransactionStatus.Success,
        productId: null,
        senderId: null,
        fee: 0,
        value: 1200,
        valueIncFees: 1200,
        createdAt: new Date(now.getTime() - 1000),
      },
      {
        processor: UserTransactionProcessor.Njord,
        receiverId: 't-tsq-1',
        status: UserTransactionStatus.Success,
        productId: null,
        senderId: null,
        fee: 0,
        value: 100,
        valueIncFees: 100,
        createdAt: new Date(now.getTime() - 1000),
      },
    ]);
  });

  it('should not authorize when not logged in', async () => {
    await testMutationErrorCode(
      client,
      {
        mutation: QUERY,
      },
      'UNAUTHENTICATED',
    );
  });

  it('should return transaction summary', async () => {
    loggedUser = 't-tsq-1';

    const res = await client.query(QUERY);

    expect(res.errors).toBeFalsy();

    expect(res.data.transactionSummary).toMatchObject({
      purchased: 1300,
      received: 285,
      spent: 200,
    });
  });
});

describe('query userProductSummary', () => {
  const QUERY = `
  query userProductSummary($userId: ID!, $limit: Int = 24, $type: ProductType!) {
    userProductSummary(userId: $userId, limit: $limit, type: $type) {
      id
      name
      image
      count
    }
  }
`;

  beforeEach(async () => {
    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => {
        return {
          ...item,
          id: `t-pasq-${item.id}`,
          username: `t-pasq-${item.username}`,
          github: undefined,
        };
      }),
    );

    const now = new Date();

    await saveFixtures(con, Product, [
      {
        id: '3f73343b-b1ae-45fc-bc3c-ded01d149596',
        name: 'Award 1',
        image: 'https://daily.dev/award.jpg',
        type: ProductType.Award,
        value: 42,
      },
      {
        id: '68089462-54f2-4dbd-9338-8983d142aef5',
        name: 'Award 2',
        image: 'https://daily.dev/award.jpg',
        type: ProductType.Award,
        value: 100,
      },
      {
        id: '7d610a0e-8790-467f-81a8-fa2b7b727c6d',
        name: 'Award 3',
        image: 'https://daily.dev/award.jpg',
        type: ProductType.Award,
        value: 20,
      },
    ]);

    await saveFixtures(con, UserTransaction, [
      {
        processor: UserTransactionProcessor.Njord,
        receiverId: 't-pasq-1',
        status: UserTransactionStatus.Success,
        productId: '3f73343b-b1ae-45fc-bc3c-ded01d149596',
        senderId: 't-pasq-2',
        fee: 5,
        value: 100,
        valueIncFees: 95,
        createdAt: new Date(now.getTime() - 3000),
      },
      {
        processor: UserTransactionProcessor.Njord,
        receiverId: 't-pasq-1',
        status: UserTransactionStatus.Success,
        productId: '3f73343b-b1ae-45fc-bc3c-ded01d149596',
        senderId: 't-pasq-2',
        fee: 5,
        value: 200,
        valueIncFees: 190,
        createdAt: new Date(now.getTime() - 3000),
      },
      {
        processor: UserTransactionProcessor.Njord,
        receiverId: 't-pasq-1',
        status: UserTransactionStatus.Error,
        productId: '3f73343b-b1ae-45fc-bc3c-ded01d149596',
        senderId: 't-pasq-2',
        fee: 5,
        value: 50,
        valueIncFees: 50,
        createdAt: new Date(now.getTime() - 2000),
      },
      {
        processor: UserTransactionProcessor.Njord,
        receiverId: 't-pasq-1',
        status: UserTransactionStatus.Success,
        productId: '68089462-54f2-4dbd-9338-8983d142aef5',
        senderId: 't-pasq-2',
        fee: 5,
        value: 200,
        valueIncFees: 190,
        createdAt: new Date(now.getTime() - 3000),
      },
      {
        processor: UserTransactionProcessor.Njord,
        receiverId: 't-pasq-1',
        status: UserTransactionStatus.Error,
        productId: '68089462-54f2-4dbd-9338-8983d142aef5',
        senderId: 't-pasq-2',
        fee: 5,
        value: 50,
        valueIncFees: 50,
        createdAt: new Date(now.getTime() - 2000),
      },
      {
        processor: UserTransactionProcessor.Njord,
        receiverId: 't-pasq-1',
        status: UserTransactionStatus.Success,
        productId: '7d610a0e-8790-467f-81a8-fa2b7b727c6d',
        senderId: 't-pasq-2',
        fee: 5,
        value: 200,
        valueIncFees: 190,
        createdAt: new Date(now.getTime() - 3000),
      },
    ]);
  });

  it('should return product award summary', async () => {
    const res = await client.query(QUERY, {
      variables: {
        userId: 't-pasq-1',
        type: ProductType.Award,
      },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data.userProductSummary).toMatchObject([
      {
        id: '3f73343b-b1ae-45fc-bc3c-ded01d149596',
        name: 'Award 1',
        image: 'https://daily.dev/award.jpg',
        count: 2,
      },
      {
        id: '68089462-54f2-4dbd-9338-8983d142aef5',
        name: 'Award 2',
        image: 'https://daily.dev/award.jpg',
        count: 1,
      },
      {
        id: '7d610a0e-8790-467f-81a8-fa2b7b727c6d',
        name: 'Award 3',
        image: 'https://daily.dev/award.jpg',
        count: 1,
      },
    ]);
  });

  it('should return limited product award summary', async () => {
    const res = await client.query(QUERY, {
      variables: {
        userId: 't-pasq-1',
        limit: 2,
        type: ProductType.Award,
      },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data.userProductSummary).toMatchObject([
      {
        id: '3f73343b-b1ae-45fc-bc3c-ded01d149596',
        name: 'Award 1',
        image: 'https://daily.dev/award.jpg',
        count: 2,
      },
      {
        id: '68089462-54f2-4dbd-9338-8983d142aef5',
        name: 'Award 2',
        image: 'https://daily.dev/award.jpg',
        count: 1,
      },
    ]);
  });
});
