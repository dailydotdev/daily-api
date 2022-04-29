import {
  ReputationEvent,
  ReputationType,
  ReputationReason,
} from './../../src/entity/ReputationEvent';
import { Connection, getConnection } from 'typeorm';
import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/commentUpvoteCanceledRep';
import { Comment, Post, Source, User } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';

let con: Connection;

beforeAll(async () => {
  con = await getConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
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
  const deleted = await repo.findOne({
    grantById: '2',
    grantToId: '1',
    targetId: 'c1',
    targetType: ReputationType.Post,
    reason: ReputationReason.PostUpvoted,
  });
  expect(deleted).toEqual(undefined);
});
