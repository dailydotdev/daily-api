import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { createMockNjordTransport, saveFixtures } from '../helpers';
import { usersFixture } from '../fixture';

import { Product, ProductType } from '../../src/entity/Product';
import type { AuthContext } from '../../src/Context';
import { createClient } from '@connectrpc/connect';
import { Credits, EntityType } from '@dailydotdev/schema';
import * as njordCommon from '../../src/common/njord';
import { User } from '../../src/entity/user/User';
import { ForbiddenError } from 'apollo-server-errors';
import { UserTransaction } from '../../src/entity/user/UserTransaction';
import * as redisFile from '../../src/redis';
import { ioRedisPool } from '../../src/redis';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('transferCores', () => {
  beforeEach(async () => {
    jest.clearAllMocks();

    const mockTransport = createMockNjordTransport();
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
      async () =>
        await njordCommon.transferCores({
          ctx: {
            userId: undefined,
          } as unknown as AuthContext,
          transaction: con.getRepository(UserTransaction).create({}),
        }),
    ).rejects.toThrow(new ForbiddenError('Auth is required'));
  });

  it('should transfer cores', async () => {
    const transaction = await njordCommon.createTransaction({
      ctx: {
        userId: 't-tc-1',
      } as unknown as AuthContext,
      entityManager: con.manager,
      productId: 'dd65570f-86c0-40a0-b8a0-3fdbd0d3945d',
      receiverId: 't-tc-2',
      note: 'Test test!',
    });

    await njordCommon.transferCores({
      ctx: {
        userId: 't-tc-1',
      } as unknown as AuthContext,
      transaction,
    });

    expect(transaction).toMatchObject({
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

    const transactionAfter = await con
      .getRepository(UserTransaction)
      .findOneByOrFail({
        id: transaction.id,
      });

    expect(transactionAfter.id).toBe(transaction.id);
    expect(transactionAfter).toMatchObject(transaction);
  });
});

describe('getBalance', () => {
  beforeEach(async () => {
    await ioRedisPool.execute((client) => client.flushall());
    jest.clearAllMocks();

    const mockTransport = createMockNjordTransport();
    jest
      .spyOn(njordCommon, 'getNjordClient')
      .mockImplementation(() => createClient(Credits, mockTransport));

    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => {
        return {
          ...item,
          id: `t-gb-${item.id}`,
          username: `t-gb-${item.username}`,
          github: undefined,
        };
      }),
    );
  });

  it('should return balance', async () => {
    const setRedisObjectWithExpirySpy = jest.spyOn(
      redisFile,
      'setRedisObjectWithExpiry',
    );
    const getRedisObjectSpy = jest.spyOn(redisFile, 'getRedisObject');

    const testNjordClient = njordCommon.getNjordClient();
    await testNjordClient.transfer({
      sender: { id: 'system', type: EntityType.SYSTEM },
      receiver: { id: 't-gb-1', type: EntityType.USER },
      amount: 100,
      idempotencyKey: crypto.randomUUID(),
    });

    const result = await njordCommon.getBalance({
      ctx: { userId: 't-gb-1' } as AuthContext,
    });

    expect(result).toEqual({ amount: 100 });
    expect(getRedisObjectSpy).toHaveBeenCalledTimes(1);
    expect(setRedisObjectWithExpirySpy).toHaveBeenCalledTimes(1);
  });

  it('should save with redis keys', async () => {
    const setRedisObjectWithExpirySpy = jest.spyOn(
      redisFile,
      'setRedisObjectWithExpiry',
    );
    const getRedisObjectSpy = jest.spyOn(redisFile, 'getRedisObject');

    const result = await njordCommon.getBalance({
      ctx: { userId: 't-gb-1' } as AuthContext,
    });

    expect(result).toEqual({ amount: 0 });

    expect(getRedisObjectSpy).toHaveBeenCalledWith(
      'njord:cores_balance:t-gb-1',
    );
    expect(setRedisObjectWithExpirySpy).toHaveBeenCalledWith(
      'njord:cores_balance:t-gb-1',
      JSON.stringify(result),
      expect.any(Number),
    );
  });

  it('should return cached balance', async () => {
    const setRedisObjectWithExpirySpy = jest.spyOn(
      redisFile,
      'setRedisObjectWithExpiry',
    );
    const getRedisObjectSpy = jest.spyOn(redisFile, 'getRedisObject');
    const getFreshBalanceSpy = jest.spyOn(njordCommon, 'getFreshBalance');

    const testNjordClient = njordCommon.getNjordClient();
    await testNjordClient.transfer({
      sender: { id: 'system', type: EntityType.SYSTEM },
      receiver: { id: 't-gb-1', type: EntityType.USER },
      amount: 42,
      idempotencyKey: crypto.randomUUID(),
    });

    const resultNotCached = await njordCommon.getBalance({
      ctx: { userId: 't-gb-1' } as AuthContext,
    });

    expect(resultNotCached).toEqual({ amount: 42 });

    expect(getRedisObjectSpy).toHaveBeenCalledTimes(1);
    expect(setRedisObjectWithExpirySpy).toHaveBeenCalledTimes(1);
    expect(getFreshBalanceSpy).toHaveBeenCalledTimes(1);

    const result = await njordCommon.getBalance({
      ctx: { userId: 't-gb-1' } as AuthContext,
    });

    expect(result).toEqual({ amount: 42 });

    expect(getRedisObjectSpy).toHaveBeenCalledTimes(2);
    expect(setRedisObjectWithExpirySpy).toHaveBeenCalledTimes(1);
    expect(getFreshBalanceSpy).toHaveBeenCalledTimes(1);
  });

  it('should fetch fresh balance if cache is expired', async () => {
    const setRedisObjectWithExpirySpy = jest.spyOn(
      redisFile,
      'setRedisObjectWithExpiry',
    );
    const getRedisObjectSpy = jest.spyOn(redisFile, 'getRedisObject');
    const getFreshBalanceSpy = jest.spyOn(njordCommon, 'getFreshBalance');

    const testNjordClient = njordCommon.getNjordClient();
    await testNjordClient.transfer({
      sender: { id: 'system', type: EntityType.SYSTEM },
      receiver: { id: 't-gb-1', type: EntityType.USER },
      amount: 42,
      idempotencyKey: crypto.randomUUID(),
    });

    const resultNotCached = await njordCommon.getBalance({
      ctx: { userId: 't-gb-1' } as AuthContext,
    });

    expect(resultNotCached).toEqual({ amount: 42 });

    expect(getRedisObjectSpy).toHaveBeenCalledTimes(1);
    expect(setRedisObjectWithExpirySpy).toHaveBeenCalledTimes(1);
    expect(getFreshBalanceSpy).toHaveBeenCalledTimes(1);

    const result = await njordCommon.getBalance({
      ctx: { userId: 't-gb-1' } as AuthContext,
    });

    expect(result).toEqual({ amount: 42 });

    expect(getRedisObjectSpy).toHaveBeenCalledTimes(2);
    expect(setRedisObjectWithExpirySpy).toHaveBeenCalledTimes(1);
    expect(getFreshBalanceSpy).toHaveBeenCalledTimes(1);

    await ioRedisPool.execute((client) => {
      return client.expire('njord:cores_balance:t-gb-1', 0);
    });

    const resultExpired = await njordCommon.getBalance({
      ctx: { userId: 't-gb-1' } as AuthContext,
    });

    expect(resultExpired).toEqual({ amount: 42 });

    expect(getRedisObjectSpy).toHaveBeenCalledTimes(3);
    expect(setRedisObjectWithExpirySpy).toHaveBeenCalledTimes(2);
    expect(getFreshBalanceSpy).toHaveBeenCalledTimes(2);
  });

  it('should return 0 if no balance', async () => {
    const result = await njordCommon.getBalance({
      ctx: { userId: 't-gb-1-not-exists' } as AuthContext,
    });

    expect(result).toEqual({ amount: 0 });
  });
});

describe('updatedBalanceCache', () => {
  beforeEach(async () => {
    await ioRedisPool.execute((client) => client.flushall());
    jest.clearAllMocks();

    const mockTransport = createMockNjordTransport();
    jest
      .spyOn(njordCommon, 'getNjordClient')
      .mockImplementation(() => createClient(Credits, mockTransport));
  });

  it('should update balance cache', async () => {
    const setRedisObjectWithExpirySpy = jest.spyOn(
      redisFile,
      'setRedisObjectWithExpiry',
    );

    const resultBefore = await njordCommon.getBalance({
      ctx: { userId: 't-ubc-1' } as AuthContext,
    });

    expect(resultBefore).toEqual({ amount: 0 });

    await njordCommon.updateBalanceCache({
      ctx: { userId: 't-ubc-1' } as AuthContext,
      value: { amount: 101 },
    });

    expect(setRedisObjectWithExpirySpy).toHaveBeenCalledWith(
      'njord:cores_balance:t-ubc-1',
      JSON.stringify({ amount: 101 }),
      expect.any(Number),
    );

    const resultAfter = await njordCommon.getBalance({
      ctx: { userId: 't-ubc-1' } as AuthContext,
    });

    expect(resultAfter).toEqual({ amount: 101 });
  });
});

describe('expireBalanceCache', () => {
  beforeEach(async () => {
    await ioRedisPool.execute((client) => client.flushall());
    jest.clearAllMocks();

    const mockTransport = createMockNjordTransport();
    jest
      .spyOn(njordCommon, 'getNjordClient')
      .mockImplementation(() => createClient(Credits, mockTransport));
  });

  it('should expire balance cache', async () => {
    const deleteRedisKeySpy = jest.spyOn(redisFile, 'deleteRedisKey');
    const getFreshBalanceSpy = jest.spyOn(njordCommon, 'getFreshBalance');

    await njordCommon.getBalance({
      ctx: { userId: 't-ebc-1' } as AuthContext,
    });

    expect(getFreshBalanceSpy).toHaveBeenCalledTimes(1);

    await njordCommon.getBalance({
      ctx: { userId: 't-ebc-1' } as AuthContext,
    });

    expect(getFreshBalanceSpy).toHaveBeenCalledTimes(1);

    await njordCommon.expireBalanceCache({
      ctx: { userId: 't-ebc-1' } as AuthContext,
    });

    expect(deleteRedisKeySpy).toHaveBeenCalledWith(
      'njord:cores_balance:t-ebc-1',
    );

    await njordCommon.getBalance({
      ctx: { userId: 't-ebc-1' } as AuthContext,
    });

    expect(getFreshBalanceSpy).toHaveBeenCalledTimes(2);
  });
});
