import type { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { expectSuccessfulTypedBackground, saveFixtures } from '../../helpers';
import { typedWorkers } from '../../../src/workers';
import { postAuthorReputationEvent as worker } from '../../../src/workers/postAnalytics/postAuthorReputationEvent';
import { PostAnalytics } from '../../../src/entity/posts/PostAnalytics';
import { Post } from '../../../src/entity/posts/Post';
import {
  ReputationReason,
  reputationReasonAmount,
  ReputationType,
} from '../../../src/entity/ReputationEvent';
import { Source } from '../../../src/entity/Source';
import { sourcesFixture, usersFixture } from '../../fixture';
import { User } from '../../../src/entity/user/User';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('postAuthorReputationEvent worker', () => {
  beforeEach(async () => {
    jest.resetAllMocks();

    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => {
        return {
          id: `parew-${item.id}`,
          username: `parew-${item.username}`,
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

  it('should increment reputation post analytics', async () => {
    const postAnalyticsBefore = await con.getRepository(PostAnalytics).findOne({
      where: { id: 'pau-p1' },
    });

    expect(postAnalyticsBefore).toBeNull();

    await con.getRepository(Post).save({
      id: 'pau-p1',
      shortId: 'pau-p1',
      authorId: 'parew-2',
      sourceId: 'a',
    });

    await expectSuccessfulTypedBackground(worker, {
      op: 'c',
      payload: {
        grantById: 'parew-1',
        grantToId: 'parew-2',
        targetId: 'pau-p1',
        reason: ReputationReason.PostUpvoted,
        targetType: ReputationType.Post,
        amount: reputationReasonAmount[ReputationReason.PostUpvoted],
        timestamp: new Date().getTime(),
      },
    });

    const postAnalytics = await con.getRepository(PostAnalytics).findOne({
      where: { id: 'pau-p1' },
    });

    expect(postAnalytics).not.toBeNull();
    expect(postAnalytics!.reputation).toBe(
      reputationReasonAmount[ReputationReason.PostUpvoted],
    );
  });

  it('should decrement reputation post analytics', async () => {
    const postAnalyticsBefore = await con.getRepository(PostAnalytics).findOne({
      where: { id: 'pau-p1' },
    });

    expect(postAnalyticsBefore).toBeNull();

    await con.getRepository(Post).save({
      id: 'pau-p1',
      shortId: 'pau-p1',
      authorId: 'parew-2',
      sourceId: 'a',
    });

    await expectSuccessfulTypedBackground(worker, {
      op: 'd',
      payload: {
        grantById: 'parew-1',
        grantToId: 'parew-2',
        targetId: 'pau-p1',
        reason: ReputationReason.PostUpvoted,
        targetType: ReputationType.Post,
        amount: reputationReasonAmount[ReputationReason.PostUpvoted],
        timestamp: new Date().getTime(),
      },
    });

    const postAnalytics = await con.getRepository(PostAnalytics).findOne({
      where: { id: 'pau-p1' },
    });

    expect(postAnalytics).not.toBeNull();
    expect(postAnalytics!.reputation).toBe(
      -reputationReasonAmount[ReputationReason.PostUpvoted],
    );
  });

  it('should not change reputation if post does not have an author', async () => {
    await con.getRepository(PostAnalytics).save({
      id: 'pau-p1',
      reputation: 0,
    });

    await con.getRepository(Post).save({
      id: 'pau-p1',
      shortId: 'pau-p1',
      sourceId: 'a',
    });

    await expectSuccessfulTypedBackground(worker, {
      op: 'c',
      payload: {
        grantById: 'parew-1',
        grantToId: 'parew-2',
        targetId: 'pau-p1',
        reason: ReputationReason.PostUpvoted,
        targetType: ReputationType.Post,
        amount: reputationReasonAmount[ReputationReason.PostUpvoted],
        timestamp: new Date().getTime(),
      },
    });

    const postAnalytics = await con.getRepository(PostAnalytics).findOne({
      where: { id: 'pau-p1' },
    });

    expect(postAnalytics).not.toBeNull();
    expect(postAnalytics!.reputation).toBe(0);
  });

  it('should not change reputation if reputation grantToId is not author', async () => {
    await con.getRepository(PostAnalytics).save({
      id: 'pau-p1',
      reputation: 0,
    });

    await con.getRepository(Post).save({
      id: 'pau-p1',
      shortId: 'pau-p1',
      authorId: 'parew-2',
      sourceId: 'a',
    });

    await expectSuccessfulTypedBackground(worker, {
      op: 'c',
      payload: {
        grantById: 'parew-1',
        grantToId: 'parew-3',
        targetId: 'pau-p1',
        reason: ReputationReason.PostUpvoted,
        targetType: ReputationType.Post,
        amount: reputationReasonAmount[ReputationReason.PostUpvoted],
        timestamp: new Date().getTime(),
      },
    });

    const postAnalytics = await con.getRepository(PostAnalytics).findOne({
      where: { id: 'pau-p1' },
    });

    expect(postAnalytics).not.toBeNull();
    expect(postAnalytics!.reputation).toBe(0);
  });

  it('should upsert reputation', async () => {
    await con.getRepository(PostAnalytics).save({
      id: 'pau-p1',
      reputation: 50,
    });

    await con.getRepository(Post).save({
      id: 'pau-p1',
      shortId: 'pau-p1',
      authorId: 'parew-2',
      sourceId: 'a',
    });

    await expectSuccessfulTypedBackground(worker, {
      op: 'c',
      payload: {
        grantById: 'parew-1',
        grantToId: 'parew-2',
        targetId: 'pau-p1',
        reason: ReputationReason.PostUpvoted,
        targetType: ReputationType.Post,
        amount: reputationReasonAmount[ReputationReason.PostUpvoted],
        timestamp: new Date().getTime(),
      },
    });

    const postAnalytics = await con.getRepository(PostAnalytics).findOne({
      where: { id: 'pau-p1' },
    });

    expect(postAnalytics).not.toBeNull();
    expect(postAnalytics!.reputation).toBe(60);
  });
});
