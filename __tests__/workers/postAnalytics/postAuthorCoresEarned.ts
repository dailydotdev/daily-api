import type { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { expectSuccessfulTypedBackground, saveFixtures } from '../../helpers';
import { typedWorkers } from '../../../src/workers';
import { postAuthorCoresEarned as worker } from '../../../src/workers/postAnalytics/postAuthorCoresEarned';
import { PostAnalytics } from '../../../src/entity/posts/PostAnalytics';
import { Post } from '../../../src/entity/posts/Post';

import { Source } from '../../../src/entity/Source';
import { sourcesFixture, usersFixture } from '../../fixture';
import { User } from '../../../src/entity/user/User';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
  UserTransactionType,
} from '../../../src/entity/user/UserTransaction';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('postAuthorCoresEarned worker', () => {
  beforeEach(async () => {
    jest.resetAllMocks();

    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => {
        return {
          id: `pacew-${item.id}`,
          username: `pacew-${item.username}`,
        };
      }),
    );
    await saveFixtures(con, Source, sourcesFixture);
  });

  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );
    expect(registeredWorker).toBeDefined();
  });

  it('should increment coresEarned post analytics', async () => {
    const postAnalyticsBefore = await con.getRepository(PostAnalytics).findOne({
      where: { id: 'pacew-p1' },
    });

    expect(postAnalyticsBefore).toBeNull();

    await con.getRepository(Post).save({
      id: 'pacew-p1',
      shortId: 'pacew-p1',
      authorId: 'pacew-2',
      sourceId: 'a',
    });

    const transaction = await con.getRepository(UserTransaction).save({
      processor: UserTransactionProcessor.Njord,
      receiverId: 'pacew-2',
      status: UserTransactionStatus.Success,
      productId: null,
      senderId: 'pacew-1',
      fee: 20,
      value: 100,
      valueIncFees: 80,
      referenceId: 'pacew-p1',
    });

    await expectSuccessfulTypedBackground(worker, {
      transaction: {
        ...transaction,
        createdAt: transaction.createdAt.getTime(),
        updatedAt: transaction.updatedAt.getTime(),
        request: JSON.stringify(transaction.request),
        flags: JSON.stringify(transaction.flags),
      },
    });

    const postAnalytics = await con.getRepository(PostAnalytics).findOne({
      where: { id: 'pacew-p1' },
    });

    expect(postAnalytics).not.toBeNull();
    expect(postAnalytics!.coresEarned).toBe(80);
  });

  it('should not change coresEarned if post does not have an author', async () => {
    await con.getRepository(PostAnalytics).save({
      id: 'pacew-p1',
      coresEarned: 0,
    });

    await con.getRepository(Post).save({
      id: 'pacew-p1',
      shortId: 'pacew-p1',
      sourceId: 'a',
    });

    const transaction = await con.getRepository(UserTransaction).save({
      processor: UserTransactionProcessor.Njord,
      receiverId: 'pacew-2',
      status: UserTransactionStatus.Success,
      productId: null,
      senderId: 'pacew-1',
      fee: 20,
      value: 100,
      valueIncFees: 80,
      referenceId: 'pacew-p1',
    });

    await expectSuccessfulTypedBackground(worker, {
      transaction: {
        ...transaction,
        createdAt: transaction.createdAt.getTime(),
        updatedAt: transaction.updatedAt.getTime(),
        request: JSON.stringify(transaction.request),
        flags: JSON.stringify(transaction.flags),
      },
    });

    const postAnalytics = await con.getRepository(PostAnalytics).findOne({
      where: { id: 'pacew-p1' },
    });

    expect(postAnalytics).not.toBeNull();
    expect(postAnalytics!.coresEarned).toBe(0);
  });

  it('should not change coresEarned if coresEarned receiverId is not author', async () => {
    await con.getRepository(PostAnalytics).save({
      id: 'pacew-p1',
      coresEarned: 0,
    });

    await con.getRepository(Post).save({
      id: 'pacew-p1',
      shortId: 'pacew-p1',
      authorId: 'pacew-2',
      sourceId: 'a',
    });

    const transaction = await con.getRepository(UserTransaction).save({
      processor: UserTransactionProcessor.Njord,
      receiverId: 'pacew-3',
      status: UserTransactionStatus.Success,
      productId: null,
      senderId: 'pacew-1',
      fee: 20,
      value: 100,
      valueIncFees: 80,
      referenceId: 'pacew-p1',
    });

    await expectSuccessfulTypedBackground(worker, {
      transaction: {
        ...transaction,
        createdAt: transaction.createdAt.getTime(),
        updatedAt: transaction.updatedAt.getTime(),
        request: JSON.stringify(transaction.request),
        flags: JSON.stringify(transaction.flags),
      },
    });

    const postAnalytics = await con.getRepository(PostAnalytics).findOne({
      where: { id: 'pacew-p1' },
    });

    expect(postAnalytics).not.toBeNull();
    expect(postAnalytics!.coresEarned).toBe(0);
  });

  it('should not change coresEarned if referenceId is not post', async () => {
    await con.getRepository(PostAnalytics).save({
      id: 'pacew-p1',
      coresEarned: 0,
    });

    await con.getRepository(Post).save({
      id: 'pacew-p1',
      shortId: 'pacew-p1',
      authorId: 'pacew-2',
      sourceId: 'a',
    });

    const transaction = await con.getRepository(UserTransaction).save({
      processor: UserTransactionProcessor.Njord,
      receiverId: 'pacew-3',
      status: UserTransactionStatus.Success,
      productId: null,
      senderId: 'pacew-1',
      fee: 20,
      value: 100,
      valueIncFees: 80,
      referenceId: 'pacew-source-1',
    });

    await expectSuccessfulTypedBackground(worker, {
      transaction: {
        ...transaction,
        createdAt: transaction.createdAt.getTime(),
        updatedAt: transaction.updatedAt.getTime(),
        request: JSON.stringify(transaction.request),
        flags: JSON.stringify(transaction.flags),
      },
    });

    const postAnalytics = await con.getRepository(PostAnalytics).findOne({
      where: { id: 'pacew-p1' },
    });

    expect(postAnalytics).not.toBeNull();
    expect(postAnalytics!.coresEarned).toBe(0);
  });

  it('should not change coresEarned if referenceId is not set', async () => {
    await con.getRepository(PostAnalytics).save({
      id: 'pacew-p1',
      coresEarned: 0,
    });

    await con.getRepository(Post).save({
      id: 'pacew-p1',
      shortId: 'pacew-p1',
      authorId: 'pacew-2',
      sourceId: 'a',
    });

    const transaction = await con.getRepository(UserTransaction).save({
      processor: UserTransactionProcessor.Njord,
      receiverId: 'pacew-3',
      status: UserTransactionStatus.Success,
      productId: null,
      senderId: 'pacew-1',
      fee: 20,
      value: 100,
      valueIncFees: 80,
    });

    await expectSuccessfulTypedBackground(worker, {
      transaction: {
        ...transaction,
        createdAt: transaction.createdAt.getTime(),
        updatedAt: transaction.updatedAt.getTime(),
        request: JSON.stringify(transaction.request),
        flags: JSON.stringify(transaction.flags),
      },
    });

    const postAnalytics = await con.getRepository(PostAnalytics).findOne({
      where: { id: 'pacew-p1' },
    });

    expect(postAnalytics).not.toBeNull();
    expect(postAnalytics!.coresEarned).toBe(0);
  });

  it('should upsert coresEarned', async () => {
    await con.getRepository(PostAnalytics).save({
      id: 'pacew-p1',
      coresEarned: 50,
    });

    await con.getRepository(Post).save({
      id: 'pacew-p1',
      shortId: 'pacew-p1',
      authorId: 'pacew-2',
      sourceId: 'a',
    });

    const transaction = await con.getRepository(UserTransaction).save({
      processor: UserTransactionProcessor.Njord,
      receiverId: 'pacew-2',
      status: UserTransactionStatus.Success,
      productId: null,
      senderId: 'pacew-1',
      fee: 20,
      value: 100,
      valueIncFees: 80,
      referenceId: 'pacew-p1',
    });

    await expectSuccessfulTypedBackground(worker, {
      transaction: {
        ...transaction,
        createdAt: transaction.createdAt.getTime(),
        updatedAt: transaction.updatedAt.getTime(),
        request: JSON.stringify(transaction.request),
        flags: JSON.stringify(transaction.flags),
      },
    });

    const postAnalytics = await con.getRepository(PostAnalytics).findOne({
      where: { id: 'pacew-p1' },
    });

    expect(postAnalytics).not.toBeNull();
    expect(postAnalytics!.coresEarned).toBe(130);
  });

  it('should skip post boosts', async () => {
    await con.getRepository(PostAnalytics).save({
      id: 'pacew-p1',
      coresEarned: 50,
    });

    const postAnalyticsBefore = await con.getRepository(PostAnalytics).findOne({
      where: { id: 'pacew-p1' },
    });

    expect(postAnalyticsBefore).not.toBeNull();
    expect(postAnalyticsBefore!.coresEarned).toBe(50);

    await con.getRepository(Post).save({
      id: 'pacew-p1',
      shortId: 'pacew-p1',
      authorId: 'pacew-2',
      sourceId: 'a',
    });

    const transaction = await con.getRepository(UserTransaction).save({
      processor: UserTransactionProcessor.Njord,
      receiverId: 'pacew-2',
      status: UserTransactionStatus.Success,
      productId: null,
      senderId: 'pacew-1',
      fee: 20,
      value: 100,
      valueIncFees: 80,
      referenceId: 'pacew-p1',
      referenceType: UserTransactionType.PostBoost,
    });

    await expectSuccessfulTypedBackground(worker, {
      transaction: {
        ...transaction,
        createdAt: transaction.createdAt.getTime(),
        updatedAt: transaction.updatedAt.getTime(),
        request: JSON.stringify(transaction.request),
        flags: JSON.stringify(transaction.flags),
      },
    });

    const postAnalytics = await con.getRepository(PostAnalytics).findOne({
      where: { id: 'pacew-p1' },
    });

    expect(postAnalytics).not.toBeNull();
    expect(postAnalytics!.coresEarned).toBe(50);
  });
});
