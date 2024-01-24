import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/commentUpvoteCanceledRep';
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

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

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

it('should delete the reputation event relevant to granting of reputation', async () => {
  const repo = con.getRepository(ReputationEvent);
  await repo.save(
    repo.create({
      grantById: '2',
      grantToId: '1',
      targetId: 'c1',
      targetType: ReputationType.Comment,
      reason: ReputationReason.CommentUpvoted,
    }),
  );
  await expectSuccessfulBackground(worker, {
    userId: '2',
    commentId: 'c1',
  });
  const deleted = await repo.findOneBy({
    grantById: '2',
    grantToId: '1',
    targetId: 'c1',
    targetType: ReputationType.Post,
    reason: ReputationReason.PostUpvoted,
  });
  expect(deleted).toEqual(null);
});
