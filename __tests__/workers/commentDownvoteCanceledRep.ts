import { expectSuccessfulTypedBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/commentDownvoteCanceledRep';
import {
  ArticlePost,
  Comment,
  Source,
  User,
  ReputationEvent,
  ReputationType,
  ReputationReason,
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

describe('commentUpvoteCanceledRep worker', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    await saveFixtures(con, Source, sourcesFixture);
    await saveFixtures(con, ArticlePost, postsFixture);
    await con.getRepository(User).save([
      {
        id: '1',
        name: 'Ido',
        image: 'https://daily.dev/ido.jpg',
        reputation: 250,
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
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should delete the reputation event relevant to granting of reputation', async () => {
    const repo = con.getRepository(ReputationEvent);
    await repo.save(
      repo.create({
        grantById: '2',
        grantToId: '1',
        targetId: 'c1',
        targetType: ReputationType.Comment,
        reason: ReputationReason.CommentDownvoted,
      }),
    );
    await expectSuccessfulTypedBackground(worker, {
      userId: '2',
      commentId: 'c1',
    });
    const deleted = await repo.findOneBy({
      grantById: '2',
      grantToId: '1',
      targetId: 'c1',
      targetType: ReputationType.Post,
      reason: ReputationReason.CommentDownvoted,
    });
    expect(deleted).toEqual(null);
  });
});
