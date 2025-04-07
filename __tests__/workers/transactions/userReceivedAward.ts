import { invokeNotificationWorker, saveFixtures } from '../../helpers';
import { userReceivedAward as worker } from '../../../src/workers/transactions/userReceivedAward';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { Feature, FeatureType, User } from '../../../src/entity';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
} from '../../../src/entity/user/UserTransaction';
import { workers as notificationWorkers } from '../../../src/workers/notifications';
import { usersFixture } from '../../fixture/user';
import { NotificationType } from '../../../src/notifications/common';
import type { ChangeObject } from '../../../src/types';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('userReceivedAward worker', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    await saveFixtures(con, User, usersFixture);
  });

  it('should be registered', () => {
    const registeredWorker = notificationWorkers.find(
      (item) => item.subscription === worker.subscription,
    );
    expect(registeredWorker).toBeDefined();
  });

  it('should do nothing if transaction not found', async () => {
    const result = await invokeNotificationWorker(worker, {
      transaction: {
        id: '87b79108-d258-42d2-b38a-4a02974746cc',
      },
    });

    expect(result).toBeUndefined();
  });

  it('should do nothing if processor is not Njord', async () => {
    const tx = con.getRepository(UserTransaction).create({
      processor: UserTransactionProcessor.Paddle,
      receiverId: '1',
      senderId: '2',
      value: 100,
      valueIncFees: 100,
      fee: 0,
      request: {},
      flags: {},
      productId: null,
      status: UserTransactionStatus.Success,
    });
    const transaction = await con.getRepository(UserTransaction).save(tx);

    const result = await invokeNotificationWorker(worker, {
      transaction: transaction as unknown as ChangeObject<UserTransaction>,
    });

    expect(result).toBeUndefined();
  });

  it('should do nothing if recipient is not a team member', async () => {
    const tx = con.getRepository(UserTransaction).create({
      processor: UserTransactionProcessor.Njord,
      receiverId: '1', // No Team feature for this user
      senderId: '2',
      value: 100,
      valueIncFees: 100,
      fee: 0,
      request: {},
      flags: {},
      productId: null,
      status: UserTransactionStatus.Success,
    });
    const transaction = await con.getRepository(UserTransaction).save(tx);

    const result = await invokeNotificationWorker(worker, {
      transaction: transaction as unknown as ChangeObject<UserTransaction>,
    });

    expect(result).toBeUndefined();
  });

  it('should create notification for team member who received an award', async () => {
    // Add Team feature for user 1
    await con.getRepository(Feature).save({
      feature: FeatureType.Team,
      userId: '1',
      value: 1,
    });

    // Create transaction
    const tx = con.getRepository(UserTransaction).create({
      processor: UserTransactionProcessor.Njord,
      receiverId: '1',
      senderId: '2',
      value: 100,
      valueIncFees: 100,
      fee: 0,
      request: {},
      flags: {},
      productId: null,
      status: UserTransactionStatus.Success,
    });
    const transaction = await con.getRepository(UserTransaction).save(tx);

    const result = await invokeNotificationWorker(worker, {
      transaction: transaction as unknown as ChangeObject<UserTransaction>,
    });

    expect(result).toBeTruthy();
    expect(result).toHaveLength(1);
    expect(result![0].type).toEqual(NotificationType.UserReceivedAward);
    expect(result![0].ctx.userIds).toEqual(['1']);
    expect(result![0].ctx.transaction).toMatchObject(transaction);
    expect(result![0].ctx.awarder).toBeTruthy();
    expect(result![0].ctx.recipient).toBeTruthy();
  });
});
