import type { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { expectSuccessfulTypedBackground } from '../helpers';
import { typedWorkers } from '../../src/workers';
import { postAnalyticsUpdate as worker } from '../../src/workers/postAnalyticsUpdate';
import { PostAnalytics } from '../../src/entity/posts/PostAnalytics';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('postAnalyticsUpdate worker', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
  });

  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );
    expect(registeredWorker).toBeDefined();
  });

  it('should set post analytics', async () => {
    const postAnalyticsBefore = await con.getRepository(PostAnalytics).findOne({
      where: { id: 'pau-p1' },
    });

    expect(postAnalyticsBefore).toBeNull();

    await expectSuccessfulTypedBackground(worker, {
      postId: 'pau-p1',
      payload: {
        upvotes: 10,
        downvotes: 2,
        comments: 1,
        awards: 3,
      },
    });

    const postAnalytics = await con.getRepository(PostAnalytics).findOne({
      where: { id: 'pau-p1' },
    });

    expect(postAnalytics).toBeDefined();
    expect(postAnalytics!.upvotes).toBe(10);
    expect(postAnalytics!.downvotes).toBe(2);
    expect(postAnalytics!.comments).toBe(1);
    expect(postAnalytics!.awards).toBe(3);
  });

  it('should upsert post analytics if post exists', async () => {
    await con.getRepository(PostAnalytics).save({
      id: 'pau-p1',
      upvotes: 0,
      downvotes: 2,
      comments: 1,
      awards: 1,
    });

    await expectSuccessfulTypedBackground(worker, {
      postId: 'pau-p1',
      payload: {
        upvotes: 10,
        awards: 3,
      },
    });

    const postAnalytics = await con.getRepository(PostAnalytics).findOne({
      where: { id: 'pau-p1' },
    });

    expect(postAnalytics).toBeDefined();
    expect(postAnalytics!.upvotes).toBe(10);
    expect(postAnalytics!.downvotes).toBe(2);
    expect(postAnalytics!.comments).toBe(1);
    expect(postAnalytics!.awards).toBe(3);
  });
});
