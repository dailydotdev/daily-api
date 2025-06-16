import { sourcesFixture } from './../fixture/source';
import { expectSuccessfulTypedBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/postBoostCanceledCores';
import { Post, Source, User } from '../../src/entity';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
  UserTransactionType,
} from '../../src/entity/user/UserTransaction';
import { postsFixture } from '../fixture/post';
import { usersFixture } from '../fixture/user';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { systemUser } from '../../src/common';
import { usdToCores } from '../../src/common/njord';
import { typedWorkers } from '../../src/workers';
import { createClient } from '@connectrpc/connect';
import { Credits } from '@dailydotdev/schema';
import { createMockNjordTransport } from '../helpers';
import * as njordCommon from '../../src/common/njord';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();

  // Mock the Njord client to prevent real external API calls
  const mockTransport = createMockNjordTransport();
  jest
    .spyOn(njordCommon, 'getNjordClient')
    .mockImplementation(() => createClient(Credits, mockTransport));

  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
});

describe('postBoostCanceledCores worker', () => {
  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should create a user transaction and transfer cores when post exists', async () => {
    const userId = '1';
    const postId = 'p1';
    const refundAmountUsd = 5.5;
    const campaignId = 'campaign-123';
    const expectedCores = Math.floor(usdToCores(refundAmountUsd));

    await expectSuccessfulTypedBackground(worker, {
      userId,
      postId,
      refundAmountUsd,
      campaignId,
    });

    const transactions = await con
      .getRepository(UserTransaction)
      .find({ where: { receiverId: userId } });

    expect(transactions).toHaveLength(1);
    const transaction = transactions[0];

    expect(transaction.processor).toBe(UserTransactionProcessor.Njord);
    expect(transaction.receiverId).toBe(userId);
    expect(transaction.status).toBe(UserTransactionStatus.Success);
    expect(transaction.productId).toBeNull();
    expect(transaction.senderId).toBe(systemUser.id);
    expect(transaction.value).toBe(expectedCores);
    expect(transaction.valueIncFees).toBe(550);
    expect(transaction.fee).toBe(0);
    expect(transaction.flags.note).toBe('Post boost canceled');
    expect(transaction.referenceId).toBe(campaignId);
    expect(transaction.referenceType).toBe(UserTransactionType.PostBoost);
  });

  it('should not create a transaction when post does not exist', async () => {
    const userId = '1';
    const postId = 'non-existent-post';
    const refundAmountUsd = 5.5;
    const campaignId = 'campaign-123';

    await expectSuccessfulTypedBackground(worker, {
      userId,
      postId,
      refundAmountUsd,
      campaignId,
    });

    const transactions = await con
      .getRepository(UserTransaction)
      .find({ where: { receiverId: userId } });

    expect(transactions).toHaveLength(0);
  });

  it('should handle decimal USD amounts correctly', async () => {
    const userId = '2';
    const postId = 'p2';
    const refundAmountUsd = 3.7521;
    const campaignId = 'campaign-456';

    await expectSuccessfulTypedBackground(worker, {
      userId,
      postId,
      refundAmountUsd,
      campaignId,
    });

    const transactions = await con
      .getRepository(UserTransaction)
      .find({ where: { receiverId: userId } });

    expect(transactions).toHaveLength(1);
    const transaction = transactions[0];
    expect(transaction.value).toBe(375);
  });

  it('should handle zero USD refund amount', async () => {
    const userId = '3';
    const postId = 'p3';
    const refundAmountUsd = 0;
    const campaignId = 'campaign-789';
    const expectedCores = Math.floor(usdToCores(refundAmountUsd));

    await expectSuccessfulTypedBackground(worker, {
      userId,
      postId,
      refundAmountUsd,
      campaignId,
    });

    const transactions = await con
      .getRepository(UserTransaction)
      .find({ where: { receiverId: userId } });

    expect(transactions).toHaveLength(1);
    const transaction = transactions[0];
    expect(transaction.value).toBe(expectedCores);
  });

  it('should handle large USD amounts', async () => {
    const userId = '4';
    const postId = 'p4';
    const refundAmountUsd = 100.99;
    const campaignId = 'campaign-large';
    const expectedCores = Math.floor(usdToCores(refundAmountUsd));

    await expectSuccessfulTypedBackground(worker, {
      userId,
      postId,
      refundAmountUsd,
      campaignId,
    });

    const transactions = await con
      .getRepository(UserTransaction)
      .find({ where: { receiverId: userId } });

    expect(transactions).toHaveLength(1);
    const transaction = transactions[0];
    expect(transaction.value).toBe(expectedCores);
  });

  it('should create unique transaction IDs for each request', async () => {
    const userId = '1';
    const postId = 'p1';
    const refundAmountUsd = 5.5;
    const campaignId = 'campaign-123';

    // Create two transactions for the same user
    await expectSuccessfulTypedBackground(worker, {
      userId,
      postId,
      refundAmountUsd,
      campaignId,
    });

    await expectSuccessfulTypedBackground(worker, {
      userId,
      postId,
      refundAmountUsd,
      campaignId,
    });

    const transactions = await con
      .getRepository(UserTransaction)
      .find({ where: { receiverId: userId } });

    expect(transactions).toHaveLength(2);
    expect(transactions[0].id).not.toBe(transactions[1].id);
  });

  it('should handle different campaign IDs correctly', async () => {
    const userId = '2';
    const postId = 'p2';
    const refundAmountUsd = 5.5;
    const campaignId1 = 'campaign-abc';
    const campaignId2 = 'campaign-def';

    await expectSuccessfulTypedBackground(worker, {
      userId,
      postId,
      refundAmountUsd,
      campaignId: campaignId1,
    });

    await expectSuccessfulTypedBackground(worker, {
      userId,
      postId,
      refundAmountUsd,
      campaignId: campaignId2,
    });

    const transactions = await con
      .getRepository(UserTransaction)
      .find({ where: { receiverId: userId } });

    expect(transactions).toHaveLength(2);
    expect(transactions[0].referenceId).toBe(campaignId1);
    expect(transactions[1].referenceId).toBe(campaignId2);
  });

  it('should handle multiple users with same post', async () => {
    const postId = 'p1';
    const refundAmountUsd = 5.5;
    const campaignId = 'campaign-multi';

    await expectSuccessfulTypedBackground(worker, {
      userId: '1',
      postId,
      refundAmountUsd,
      campaignId,
    });

    await expectSuccessfulTypedBackground(worker, {
      userId: '2',
      postId,
      refundAmountUsd,
      campaignId,
    });

    const user1Transactions = await con
      .getRepository(UserTransaction)
      .find({ where: { receiverId: '1' } });

    const user2Transactions = await con
      .getRepository(UserTransaction)
      .find({ where: { receiverId: '2' } });

    expect(user1Transactions).toHaveLength(1);
    expect(user2Transactions).toHaveLength(1);
    expect(user1Transactions[0].receiverId).toBe('1');
    expect(user2Transactions[0].receiverId).toBe('2');
  });

  it('should handle edge case with very small USD amount', async () => {
    const userId = '3';
    const postId = 'p3';
    const refundAmountUsd = 0.01;
    const campaignId = 'campaign-small';
    const expectedCores = Math.floor(usdToCores(refundAmountUsd));

    await expectSuccessfulTypedBackground(worker, {
      userId,
      postId,
      refundAmountUsd,
      campaignId,
    });

    const transactions = await con
      .getRepository(UserTransaction)
      .find({ where: { receiverId: userId } });

    expect(transactions).toHaveLength(1);
    const transaction = transactions[0];
    expect(transaction.value).toBe(expectedCores);
  });

  it('should handle negative USD amount (edge case)', async () => {
    const userId = '4';
    const postId = 'p4';
    const refundAmountUsd = -1.5;
    const campaignId = 'campaign-negative';
    const expectedCores = Math.floor(usdToCores(refundAmountUsd));

    await expectSuccessfulTypedBackground(worker, {
      userId,
      postId,
      refundAmountUsd,
      campaignId,
    });

    const transactions = await con
      .getRepository(UserTransaction)
      .find({ where: { receiverId: userId } });

    expect(transactions).toHaveLength(1);
    const transaction = transactions[0];
    expect(transaction.value).toBe(expectedCores);
  });
});
