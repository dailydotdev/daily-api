import { invokeTypedNotificationWorker, saveFixtures } from '../../helpers';
import { userAwardThanked as worker } from '../../../src/workers/transactions/userAwardThanked';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { Source, User } from '../../../src/entity';
import { Product, ProductType } from '../../../src/entity/Product';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
} from '../../../src/entity/user/UserTransaction';
import { workers as notificationWorkers } from '../../../src/workers/notifications';
import { usersFixture } from '../../fixture/user';
import { NotificationType } from '../../../src/notifications/common';
import type { NotificationAwardThankedContext } from '../../../src/notifications/types';
import { sourcesFixture } from '../../fixture/source';
import { env } from 'node:process';
import { ghostUser } from '../../../src/common';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('userAwardThanked worker', () => {
  const productId = '9104b834-6fac-4276-a168-0be1294ab371';

  const createAwardTransaction = (
    overrides: Partial<UserTransaction> = {},
  ): Promise<UserTransaction> =>
    con.getRepository(UserTransaction).save({
      processor: UserTransactionProcessor.Njord,
      receiverId: '1',
      senderId: '2',
      value: 100,
      valueIncFees: 100,
      fee: 0,
      request: {},
      flags: { thankedAt: new Date().toISOString() },
      productId,
      status: UserTransactionStatus.Success,
      ...overrides,
    });

  beforeEach(async () => {
    jest.resetAllMocks();
    await saveFixtures(con, User, usersFixture);
    await saveFixtures(con, Source, sourcesFixture);
    await saveFixtures(con, Product, [
      {
        id: productId,
        name: 'Test Award',
        image: 'https://daily.dev/award.jpg',
        type: ProductType.Award,
        value: 100,
      },
    ]);
  });

  it('should be registered', () => {
    const registeredWorker = notificationWorkers.find(
      (item) => item.subscription === worker.subscription,
    );
    expect(registeredWorker).toBeDefined();
  });

  it('should do nothing if transaction not found', async () => {
    const result =
      await invokeTypedNotificationWorker<'api.v1.user-award-thanked'>(worker, {
        transactionId: '87b79108-d258-42d2-b38a-4a02974746cc',
      });

    expect(result).toBeUndefined();
  });

  it('should do nothing if transaction has no productId', async () => {
    const transaction = await createAwardTransaction({ productId: null });

    const result =
      await invokeTypedNotificationWorker<'api.v1.user-award-thanked'>(worker, {
        transactionId: transaction.id,
      });

    expect(result).toBeUndefined();
  });

  it('should do nothing if processor is not Njord', async () => {
    const transaction = await createAwardTransaction({
      processor: UserTransactionProcessor.Paddle,
    });

    const result =
      await invokeTypedNotificationWorker<'api.v1.user-award-thanked'>(worker, {
        transactionId: transaction.id,
      });

    expect(result).toBeUndefined();
  });

  it('should do nothing if sender is a special user', async () => {
    const transaction = await createAwardTransaction({
      senderId: ghostUser.id,
    });

    const result =
      await invokeTypedNotificationWorker<'api.v1.user-award-thanked'>(worker, {
        transactionId: transaction.id,
      });

    expect(result).toBeUndefined();
  });

  it('should notify the original award sender that the receiver said thanks', async () => {
    const transaction = await createAwardTransaction();

    const result =
      await invokeTypedNotificationWorker<'api.v1.user-award-thanked'>(worker, {
        transactionId: transaction.id,
      });

    expect(result).toBeTruthy();
    expect(result).toHaveLength(1);
    expect(result![0].type).toEqual(NotificationType.UserAwardThanked);
    expect(result![0].ctx.userIds).toEqual(['2']);

    const ctx = result![0].ctx as NotificationAwardThankedContext;
    expect(ctx.transaction).toMatchObject(transaction);
    expect((ctx.sender as User).id).toEqual('1');
    expect((ctx.receiver as User).id).toEqual('2');
    expect(ctx.targetUrl).toEqual(`${env.COMMENTS_PREFIX}/idoshamun`);
  });
});
