import { invokeNotificationWorker, saveFixtures } from '../../helpers';
import { userReceivedAward as worker } from '../../../src/workers/transactions/userReceivedAward';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import {
  Comment,
  Feature,
  FeatureType,
  Post,
  Source,
  User,
  UserPost,
} from '../../../src/entity';
import { Product, ProductType } from '../../../src/entity/Product';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
} from '../../../src/entity/user/UserTransaction';
import { workers as notificationWorkers } from '../../../src/workers/notifications';
import { usersFixture } from '../../fixture/user';
import { NotificationType } from '../../../src/notifications/common';
import type { ChangeObject } from '../../../src/types';
import type { NotificationAwardContext } from '../../../src/notifications/types';
import { sourcesFixture } from '../../fixture/source';
import { postsFixture } from '../../fixture/post';
import { randomUUID } from 'node:crypto';
import { UserComment } from '../../../src/entity/user/UserComment';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('userReceivedAward worker', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    await saveFixtures(con, User, usersFixture);
    await saveFixtures(con, Source, sourcesFixture);
    await saveFixtures(con, Post, postsFixture);

    // Create Product fixture
    await saveFixtures(con, Product, [
      {
        id: '9104b834-6fac-4276-a168-0be1294ab371',
        name: 'Test Award',
        image: 'https://daily.dev/award.jpg',
        type: ProductType.Award,
        value: 100,
      },
    ]);

    await con.getRepository(Feature).save({
      feature: FeatureType.Team,
      userId: '1',
      value: 1,
    });
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

  it('should do nothing if transaction has no productId', async () => {
    const transaction = await con.getRepository(UserTransaction).save({
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

    const result = await invokeNotificationWorker(worker, {
      transaction: transaction as unknown as ChangeObject<UserTransaction>,
    });

    expect(result).toBeUndefined();
  });

  it('should do nothing if processor is not Njord', async () => {
    const transaction = await con.getRepository(UserTransaction).save({
      processor: UserTransactionProcessor.Paddle,
      receiverId: '1',
      senderId: '2',
      value: 100,
      valueIncFees: 100,
      fee: 0,
      request: {},
      flags: {},
      productId: '9104b834-6fac-4276-a168-0be1294ab371',
      status: UserTransactionStatus.Success,
    });

    const result = await invokeNotificationWorker(worker, {
      transaction: transaction as unknown as ChangeObject<UserTransaction>,
    });

    expect(result).toBeUndefined();
  });

  it('should do nothing if recipient is not a team member', async () => {
    const transaction = await con.getRepository(UserTransaction).save({
      processor: UserTransactionProcessor.Njord,
      receiverId: '2',
      senderId: '2',
      value: 100,
      valueIncFees: 100,
      fee: 0,
      request: {},
      flags: {},
      productId: '9104b834-6fac-4276-a168-0be1294ab371',
      status: UserTransactionStatus.Success,
    });

    const result = await invokeNotificationWorker(worker, {
      transaction: transaction as unknown as ChangeObject<UserTransaction>,
    });

    expect(result).toBeUndefined();
  });

  it('should create notification for team member who received an award', async () => {
    const transaction = await con.getRepository(UserTransaction).save({
      processor: UserTransactionProcessor.Njord,
      receiverId: '1',
      senderId: '2',
      value: 100,
      valueIncFees: 100,
      fee: 0,
      request: {},
      flags: {},
      productId: '9104b834-6fac-4276-a168-0be1294ab371',
      status: UserTransactionStatus.Success,
    });

    const result = await invokeNotificationWorker(worker, {
      transaction: transaction as unknown as ChangeObject<UserTransaction>,
    });

    expect(result).toBeTruthy();
    expect(result).toHaveLength(1);
    expect(result![0].type).toEqual(NotificationType.UserReceivedAward);
    expect(result![0].ctx.userIds).toEqual(['1']);
    expect(
      (result![0].ctx as NotificationAwardContext).transaction,
    ).toMatchObject(transaction);
    expect((result![0].ctx as NotificationAwardContext).sender).toBeTruthy();
    expect((result![0].ctx as NotificationAwardContext).receiver).toBeTruthy();
    expect((result![0].ctx as NotificationAwardContext).targetUrl).toEqual(
      '/idoshamun',
    );
  });

  it('should create notification for team member who received an award on a post', async () => {
    const transactionId = randomUUID();
    const sender = '2';

    const transaction = await con.getRepository(UserTransaction).save({
      id: transactionId,
      processor: UserTransactionProcessor.Njord,
      receiverId: '1',
      senderId: sender,
      value: 100,
      valueIncFees: 100,
      fee: 0,
      request: {},
      flags: {},
      productId: '9104b834-6fac-4276-a168-0be1294ab371',
      status: UserTransactionStatus.Success,
    });

    await con.getRepository(UserPost).save({
      postId: postsFixture[0].id,
      userId: sender,
      awardTransactionId: transactionId,
    });

    const result = await invokeNotificationWorker(worker, {
      transaction: transaction as unknown as ChangeObject<UserTransaction>,
    });

    expect(result).toBeTruthy();
    expect(result).toHaveLength(1);
    expect(result![0].type).toEqual(NotificationType.UserReceivedAward);
    expect(result![0].ctx.userIds).toEqual(['1']);
    expect(
      (result![0].ctx as NotificationAwardContext).transaction,
    ).toMatchObject(transaction);
    expect((result![0].ctx as NotificationAwardContext).sender).toBeTruthy();
    expect((result![0].ctx as NotificationAwardContext).receiver).toBeTruthy();
    expect((result![0].ctx as NotificationAwardContext).targetUrl).toEqual(
      '/posts/p1',
    );
  });

  it('should create notification for team member who received an award on a comment', async () => {
    const transactionId = randomUUID();
    const sender = '2';
    const receiver = '1';

    const transaction = await con.getRepository(UserTransaction).save({
      id: transactionId,
      processor: UserTransactionProcessor.Njord,
      receiverId: receiver,
      senderId: sender,
      value: 100,
      valueIncFees: 100,
      fee: 0,
      request: {},
      flags: {},
      productId: '9104b834-6fac-4276-a168-0be1294ab371',
      status: UserTransactionStatus.Success,
    });

    await con.getRepository(Comment).save({
      id: 'a-c-1',
      postId: postsFixture[1].id,
      userId: receiver,
      content: 'Test comment',
      awardTransactionId: transactionId,
    });

    await con.getRepository(UserComment).save({
      commentId: 'a-c-1',
      userId: sender,
      awardTransactionId: transactionId,
    });

    const result = await invokeNotificationWorker(worker, {
      transaction: transaction as unknown as ChangeObject<UserTransaction>,
    });

    expect(result).toBeTruthy();
    expect(result).toHaveLength(1);
    expect(result![0].type).toEqual(NotificationType.UserReceivedAward);
    expect(result![0].ctx.userIds).toEqual(['1']);
    expect(
      (result![0].ctx as NotificationAwardContext).transaction,
    ).toMatchObject(transaction);
    expect((result![0].ctx as NotificationAwardContext).sender).toBeTruthy();
    expect((result![0].ctx as NotificationAwardContext).receiver).toBeTruthy();
    expect((result![0].ctx as NotificationAwardContext).targetUrl).toEqual(
      '/posts/p2#c-a-c-1',
    );
  });
});
