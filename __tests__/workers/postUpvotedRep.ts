import { expectSuccessfulTypedBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/postUpvotedRep';
import {
  ArticlePost,
  Post,
  ReputationEvent,
  ReputationReason,
  ReputationType,
  Source,
  User,
} from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { typedWorkers } from '../../src/workers';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('postUpvotedRep worker', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    await saveFixtures(con, Source, sourcesFixture);
    await saveFixtures(con, ArticlePost, postsFixture);
    await con.getRepository(User).save([
      {
        id: '1',
        name: 'Ido',
        image: 'https://daily.dev/ido.jpg',
        reputation: 3,
      },
      {
        id: '2',
        name: 'Lee',
        image: 'https://daily.dev/lee.jpg',
        reputation: 251,
      },
    ]);
    await con.getRepository(Post).update('p1', { authorId: '1' });
  });

  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should create a reputation event that increases reputation', async () => {
    await expectSuccessfulTypedBackground(worker, {
      userId: '2',
      postId: 'p1',
    });
    const event = await con
      .getRepository(ReputationEvent)
      .findOne({ where: { targetId: 'p1', grantById: '2', grantToId: '1' } });
    expect(event!.amount).toEqual(10);
  });

  it('should not create a reputation event when the upvoting user is ineligible', async () => {
    await con.getRepository(User).update({ id: '2' }, { reputation: 249 });
    await expectSuccessfulTypedBackground(worker, {
      userId: '2',
      postId: 'p1',
    });
    const event = await con
      .getRepository(ReputationEvent)
      .findOneBy({ targetId: 'p1', grantById: '2', grantToId: '1' });
    expect(event).toEqual(null);
  });

  it('should not create a reputation event when the author is the upvote user', async () => {
    await expectSuccessfulTypedBackground(worker, {
      userId: '1',
      postId: 'p1',
    });

    const event = await con
      .getRepository(ReputationEvent)
      .findOneBy({ targetId: 'p1', grantById: '2', grantToId: '1' });
    expect(event).toEqual(null);
  });

  it('should not create a reputation event when user granted more than threshold in last 24 hours', async () => {
    const repo = con.getRepository(ReputationEvent);
    await repo.save(
      new Array(10).fill(0).map((_, i) =>
        repo.create({
          grantById: '2',
          grantToId: '1',
          targetId: `a${i}`,
          targetType: ReputationType.Post,
          reason: ReputationReason.PostUpvoted,
        }),
      ),
    );
    await expectSuccessfulTypedBackground(worker, {
      userId: '2',
      postId: 'p1',
    });
    const event = await repo.findOne({
      where: { targetId: 'p1', grantById: '2', grantToId: '1' },
    });
    expect(event).toEqual(null);
  });
});
