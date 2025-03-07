import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import {
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  type GraphQLTestingState,
  type GraphQLTestClient,
  testMutationErrorCode,
} from './helpers';
import { ArticlePost, PostType, Source, User, UserPost } from '../src/entity';
import { sourcesFixture, usersFixture } from './fixture';

import { FastifyInstance } from 'fastify';
import appFunc from '../src';
import { Product, ProductType } from '../src/entity/Product';
import type { AuthContext, Context } from '../src/Context';
import { createClient, createRouterTransport } from '@connectrpc/connect';
import { Credits, Currency } from '@dailydotdev/schema';
import * as njordCommon from '../src/common/njord';
import { UserTransaction } from '../src/entity/user/UserTransaction';
import { ghostUser } from '../src/common';

const mockTransport = createRouterTransport(({ service }) => {
  service(Credits, {
    transfer: (request) => {
      return {
        idempotencyKey: request.idempotencyKey,
        senderBalance: {
          account: { userId: request.sender?.id, currency: Currency.CORES },
          previousBalance: 0,
          newBalance: -request.amount,
          changeAmount: -request.amount,
        },
        receiverBalance: {
          account: { userId: request.receiver?.id, currency: Currency.CORES },
          previousBalance: 0,
          newBalance: request.amount,
          changeAmount: request.amount,
        },
        timestamp: Date.now(),
      };
    },
  });
});

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
