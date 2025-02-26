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
import { User } from '../src/entity';
import { usersFixture } from './fixture';

import { FastifyInstance } from 'fastify';
import appFunc from '../src';
import { Product, ProductType } from '../src/entity/Product';
import type { Context } from '../src/Context';
import { createClient, createRouterTransport } from '@connectrpc/connect';
import { Credits, Currency } from '@dailydotdev/schema';
import * as njordCommon from '../src/common/njord';

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
let loggedUser: string = '';

beforeAll(async () => {
  con = await createOrGetConnection();
  app = await appFunc();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser) as Context,
  );
  client = state.client;
  return app.ready();
});

describe('awardUser mutation', () => {
  const MUTATION = `
  mutation awardUser ($productId: ID!, $receiverId: ID!, $note: String) {
    awardUser(productId: $productId, receiverId: $receiverId, note: $note) {
      _
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
    testMutationErrorCode(
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

    expect(res.data).toEqual({ awardUser: { _: true } });
  });
});
