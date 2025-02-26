import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { saveFixtures } from '../helpers';
import { usersFixture } from '../fixture';

import { Product, ProductType } from '../../src/entity/Product';
import type { AuthContext } from '../../src/Context';
import { createClient, createRouterTransport } from '@connectrpc/connect';
import { Credits, Currency } from '@dailydotdev/schema';
import * as njordCommon from '../../src/common/njord';
import { User } from '../../src/entity/user/User';
import { ForbiddenError } from 'apollo-server-errors';
import { UserTransaction } from '../../src/entity/user/UserTransaction';

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

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('transferCores', () => {
  beforeEach(async () => {
    jest.resetAllMocks();

    jest
      .spyOn(njordCommon, 'getNjordClient')
      .mockImplementation(() => createClient(Credits, mockTransport));

    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => {
        return {
          ...item,
          id: `t-tc-${item.id}`,
          username: `t-tc-${item.username}`,
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

  it('should throw if not auth context', async () => {
    await expect(
      njordCommon.transferCores({
        ctx: {
          con,
          userId: undefined,
        } as unknown as AuthContext,
        productId: 'dd65570f-86c0-40a0-b8a0-3fdbd0d3945d',
        receiverId: 't-tc-2',
        note: 'Test test!',
      }),
    ).rejects.toThrow(new ForbiddenError('Auth is required'));
  });

  it('should transfer cores', async () => {
    const result = await njordCommon.transferCores({
      ctx: {
        con,
        userId: 't-tc-1',
      } as unknown as AuthContext,
      productId: 'dd65570f-86c0-40a0-b8a0-3fdbd0d3945d',
      receiverId: 't-tc-2',
      note: 'Test test!',
    });

    expect(result).toMatchObject({
      id: expect.any(String),
      receiverId: 't-tc-2',
      status: 0,
      productId: 'dd65570f-86c0-40a0-b8a0-3fdbd0d3945d',
      senderId: 't-tc-1',
      value: 42,
      fee: 5,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
      flags: {},
    } as UserTransaction);

    const transaction = await con
      .getRepository(UserTransaction)
      .findOneByOrFail({
        id: result.id,
      });

    expect(transaction.id).toBe(result.id);
    expect(transaction).toMatchObject(result);
  });
});
