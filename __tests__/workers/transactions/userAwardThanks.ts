import { invokeTypedNotificationWorker, saveFixtures } from '../../helpers';
import { userAwardThanks as worker } from '../../../src/workers/transactions/userAwardThanks';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { User } from '../../../src/entity/user/User';
import { Product, ProductType } from '../../../src/entity/Product';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
} from '../../../src/entity/user/UserTransaction';
import { workers as notificationWorkers } from '../../../src/workers/notifications';
import { usersFixture } from '../../fixture/user';
import { NotificationType } from '../../../src/notifications/common';
import type { NotificationAwardThanksContext } from '../../../src/notifications/types';
import { env } from 'node:process';
import { ghostUser } from '../../../src/common/utils';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('userAwardThanks worker', () => {
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
      flags: { thanksAt: new Date().toISOString() },
      productId,
      status: UserTransactionStatus.Success,
      ...overrides,
    });

  beforeEach(async () => {
    jest.resetAllMocks();
    await saveFixtures(con, User, usersFixture);
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
      await invokeTypedNotificationWorker<'api.v1.user-award-thanks'>(worker, {
        transactionId: '87b79108-d258-42d2-b38a-4a02974746cc',
      });

    expect(result).toBeUndefined();
  });

  it('should do nothing if transaction has no productId', async () => {
    const transaction = await createAwardTransaction({ productId: null });

    const result =
      await invokeTypedNotificationWorker<'api.v1.user-award-thanks'>(worker, {
        transactionId: transaction.id,
      });

    expect(result).toBeUndefined();
  });

  it('should do nothing if processor is not Njord', async () => {
    const transaction = await createAwardTransaction({
      processor: UserTransactionProcessor.Paddle,
    });

    const result =
      await invokeTypedNotificationWorker<'api.v1.user-award-thanks'>(worker, {
        transactionId: transaction.id,
      });

    expect(result).toBeUndefined();
  });

  it('should do nothing if transaction is not successful', async () => {
    const transaction = await createAwardTransaction({
      status: UserTransactionStatus.Processing,
    });

    const result =
      await invokeTypedNotificationWorker<'api.v1.user-award-thanks'>(worker, {
        transactionId: transaction.id,
      });

    expect(result).toBeUndefined();
  });

  it('should do nothing if sender is a special user', async () => {
    const transaction = await createAwardTransaction({
      senderId: ghostUser.id,
    });

    const result =
      await invokeTypedNotificationWorker<'api.v1.user-award-thanks'>(worker, {
        transactionId: transaction.id,
      });

    expect(result).toBeUndefined();
  });

  it('should notify the original award sender that the receiver said thanks', async () => {
    const transaction = await createAwardTransaction();

    const result =
      await invokeTypedNotificationWorker<'api.v1.user-award-thanks'>(worker, {
        transactionId: transaction.id,
      });

    expect(result).toMatchObject([
      {
        type: NotificationType.UserAwardThanks,
        ctx: { userIds: ['2'] },
      },
    ]);

    const [notification] = result ?? [];
    if (!notification) {
      throw new Error('Expected a UserAwardThanks notification');
    }

    const ctx = notification.ctx as NotificationAwardThanksContext;
    expect(ctx.transaction).toMatchObject(transaction);
    expect((ctx.sender as User).id).toEqual('1');
    expect((ctx.receiver as User).id).toEqual('2');
    expect(ctx.targetUrl).toEqual(`${env.COMMENTS_PREFIX}/idoshamun`);
  });
});
