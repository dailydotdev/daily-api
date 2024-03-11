import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/postBannedRep';
import {
  ArticlePost,
  FreeformPost,
  Post,
  PostType,
  SharePost,
  Source,
  User,
  WelcomePost,
} from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
import { PostReport, ReputationEvent } from '../../src/entity';
import { DataSource, LessThan } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { createSquadWelcomePost } from '../../src/common';

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
  expect(events.length).toEqual(2);
  expect(events[0].amount).toEqual(100);
  expect(events[1].amount).toEqual(100);
});

const createSharedPost = async (id = 'sp1', args: Partial<Post> = {}) => {
  const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
  await con.getRepository(SharePost).save({
    ...post,
    id,
    shortId: `short-${id}`,
    sharedPostId: 'p1',
    type: PostType.Share,
    ...args,
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

it('should create a reputation decrease event for the author of the welcome post', async () => {
  const source = await con.getRepository(Source).findOneBy({ id: 'b' });
  const post = await createSquadWelcomePost(con, source, '2');
  const welcome = await con
    .getRepository(WelcomePost)
    .findOneBy({ id: post.id });
  expect(welcome).toBeTruthy();
  await expectSuccessfulBackground(worker, {
    post,
  });
  const events = await con
    .getRepository(ReputationEvent)
    .find({ where: { targetId: post.id, grantById: '' } });
  expect(events.length).toEqual(1);
  expect(events[0].amount).toEqual(-100);
});

it('should create a reputation decrease event for the author of the freeform post', async () => {
  const source = await con.getRepository(Source).findOneBy({ id: 'b' });
  const post = await createSquadWelcomePost(con, source, '2');
  await con
    .getRepository(Post)
    .update({ id: post.id }, { type: PostType.Freeform });
  const welcome = await con
    .getRepository(FreeformPost)
    .findOneBy({ id: post.id });
  expect(welcome).toBeTruthy();
  await expectSuccessfulBackground(worker, {
    post,
  });
  const events = await con
    .getRepository(ReputationEvent)
    .find({ where: { targetId: post.id, grantById: '' } });
  expect(events.length).toEqual(1);
  expect(events[0].amount).toEqual(-100);
});

it('should create a reputation event that decreases reputation', async () => {
  await con
    .getRepository(Post)
    .update({ id: 'p1' }, { authorId: '1', scoutId: '2' });
  const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
  await expectSuccessfulBackground(worker, {
    post,
  });
  const events = await con
    .getRepository(ReputationEvent)
    .find({ where: { targetId: 'p1', grantById: '', amount: LessThan(0) } });
  expect(events.length).toEqual(2);
  expect(events[0].amount).toEqual(-100);
  expect(events[1].amount).toEqual(-100);
});
