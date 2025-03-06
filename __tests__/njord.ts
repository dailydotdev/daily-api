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

describe('awardUser mutation', () => {
  const MUTATION = `
  mutation awardUser ($productId: ID!, $receiverId: ID!, $note: String) {
    awardUser(productId: $productId, receiverId: $receiverId, note: $note) {
      transactionId
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
          receiverId: 't-awum-2',
          note: 'Test test!',
        },
      },
      'UNAUTHENTICATED',
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
        receiverId: 't-awum-2',
        note: 'Test test!',
      },
    });
    expect(res.errors).toBeUndefined();

    expect(res.data).toEqual({
      awardUser: { transactionId: expect.any(String) },
    });
  });
});

describe('awardPost mutation', () => {
  const MUTATION = `
  mutation awardPost ($productId: ID!, $postId: ID!, $note: String) {
    awardPost(productId: $productId, postId: $postId, note: $note) {
      transactionId
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
          postId: 'p-awpm-1',
          note: 'Test test!',
        },
      },
      'UNAUTHENTICATED',
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
          postId: 'p-awpm-1',
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
          postId: 'does-not-exist',
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
          postId: 'p-awpm-no-author',
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
          postId: 'p-awpm-1',
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
        postId: 'p-awpm-1',
        note: 'Test test!',
      },
    });
    expect(res.errors).toBeUndefined();

    expect(res.data).toEqual({
      awardPost: { transactionId: expect.any(String) },
    });

    const { transactionId } = res.data.awardPost;

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
