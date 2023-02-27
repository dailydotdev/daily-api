import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/postBannedRep';
import { ArticlePost, Post, SharePost, Source, User } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
import { PostReport, ReputationEvent } from '../../src/entity';
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
      reputation: 3,
    },
    {
      id: '2',
      name: 'Tsahi',
      image: 'https://daily.dev/tsahi.jpg',
      reputation: 6,
    },
  ]);
  await con.getRepository(PostReport).insert([
    { postId: 'p1', userId: '1', reason: 'BROKEN' },
    { postId: 'p1', userId: '2', reason: 'CLICKBAIT' },
  ]);
});

it('should create a reputation event that increases reputation', async () => {
  const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
  await expectSuccessfulBackground(worker, {
    post,
  });
  const events = await con
    .getRepository(ReputationEvent)
    .find({ where: { targetId: 'p1', grantById: '' } });
  expect(events[0].amount).toEqual(100);
  expect(events[1].amount).toEqual(100);
});

const createSharedPost = async (id = 'sp1') => {
  const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
  await con.getRepository(SharePost).save({
    ...post,
    id,
    shortId: `short-${id}`,
    sharedPostId: 'p1',
  });
};

it('should not create a reputation event for the author that shared the post', async () => {
  const sharedPostId = 'sp1';
  await createSharedPost(sharedPostId);
  const repo = con.getRepository(SharePost);
  await repo.update({ id: 'sharedId' }, { authorId: '2' });
  const post = await repo.findOneBy({ id: sharedPostId });
  await expectSuccessfulBackground(worker, {
    post,
  });
  const events = await con
    .getRepository(ReputationEvent)
    .find({ where: { targetId: 'sp1', grantById: '' } });
  expect(events.length).toEqual(0);
});
