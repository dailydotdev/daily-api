import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/commentDownvotedRep';
import {
  ArticlePost,
  Comment,
  Source,
  User,
  ReputationEvent,
} from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { workers } from '../../src/workers';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('commentDownvotedRep worker', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    await saveFixtures(con, Source, sourcesFixture);
    await saveFixtures(con, ArticlePost, postsFixture);
    await con.getRepository(User).save([
      {
        id: '1',
        name: 'Ido',
        image: 'https://daily.dev/ido.jpg',
        reputation: 53,
      },
      {
        id: '2',
        name: 'Lee',
        image: 'https://daily.dev/lee.jpg',
        reputation: 251,
      },
    ]);
    await con.getRepository(Comment).save([
      {
        id: 'c1',
        postId: 'p1',
        userId: '1',
        content: 'parent comment',
        createdAt: new Date(2020, 1, 6, 0, 0),
        upvotes: 1,
      },
    ]);
  });

  it('should be registered', () => {
    const registeredWorker = workers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should create a reputation event that decreases reputation', async () => {
    await expectSuccessfulBackground(worker, {
      userId: '2',
      commentId: 'c1',
    });
    const event = await con
      .getRepository(ReputationEvent)
      .findOne({ where: { targetId: 'c1', grantById: '2', grantToId: '1' } });
    expect(event!.amount).toEqual(-50);
  });

  it('should not create a reputation event when the downvoting user is ineligible', async () => {
    await con.getRepository(User).update({ id: '2' }, { reputation: 1 });
    await expectSuccessfulBackground(worker, {
      userId: '2',
      commentId: 'c1',
    });
    const events = await con.getRepository(ReputationEvent).find();
    expect(events.length).toEqual(0);
  });

  it('should not create a reputation event when the author is the downvote user', async () => {
    await expectSuccessfulBackground(worker, {
      userId: '1',
      commentId: 'c1',
    });

    const events = await con.getRepository(ReputationEvent).find();
    expect(events.length).toEqual(0);
  });
});
