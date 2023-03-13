import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/postUpdated';
import {
  ArticlePost,
  Keyword,
  Post,
  PostOrigin,
  PostType,
  SharePost,
  Source,
} from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, [
    {
      id: 'p1',
      shortId: 'p1',
      url: 'http://p1.com',
      score: 0,
      metadataChangedAt: new Date('01-05-2020 12:00:00'),
      sourceId: 'a',
      visible: false,
      createdAt: new Date('01-05-2020 12:00:00'),
      origin: PostOrigin.Squad,
    },
  ]);
});

const createDefaultKeywords = async () => {
  const repo = con.getRepository(Keyword);
  await repo.insert({
    value: 'mongodb',
    status: 'allow',
  });
  await repo.insert({
    value: 'alpinejs',
    status: 'allow',
  });
  await repo.insert({
    value: 'ab-testing',
    status: 'allow',
  });
  await repo.insert({
    value: 'alpine',
    status: 'synonym',
    synonym: 'alpinejs',
  });
  await repo.insert({
    value: 'a-b-testing',
    status: 'synonym',
    synonym: 'ab-testing',
  });
};

const createSharedPost = async (id = 'sp1') => {
  const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
  await con.getRepository(SharePost).save({
    ...post,
    id,
    shortId: `short-${id}`,
    sharedPostId: 'p1',
    type: PostType.Share,
    visible: false,
  });
};

it('should not update if the database updated date is newer', async () => {
  await expectSuccessfulBackground(worker, {
    post_id: 'p1',
    updated_at: new Date('01-05-1990 12:00:00'),
  });
  const post = await con.getRepository(ArticlePost).findOneBy({ id: 'p1' });
  expect(post.metadataChangedAt).toEqual(new Date('2020-01-05T12:00:00.000Z'));
});

it('should not update if the post is not a squad origin', async () => {
  await con
    .getRepository(ArticlePost)
    .update({ id: 'p1' }, { origin: PostOrigin.CommunityPicks });
  await expectSuccessfulBackground(worker, {
    post_id: 'p1',
    updated_at: new Date('01-05-1990 12:00:00'),
  });
  const post = await con.getRepository(ArticlePost).findOneBy({ id: 'p1' });
  expect(post.metadataChangedAt).toEqual(new Date('2020-01-05T12:00:00.000Z'));
});

it(`should not update if the post object doesn't have ID`, async () => {
  await con
    .getRepository(ArticlePost)
    .update({ id: 'p1' }, { origin: PostOrigin.CommunityPicks });
  await expectSuccessfulBackground(worker, {
    updated_at: new Date('01-05-1990 12:00:00'),
  });
  const post = await con.getRepository(ArticlePost).findOneBy({ id: 'p1' });
  expect(post.metadataChangedAt).toEqual(new Date('2020-01-05T12:00:00.000Z'));
});

it('should update the post and keep it invisible if title is missing', async () => {
  await expectSuccessfulBackground(worker, {
    post_id: 'p1',
    updated_at: new Date('01-05-2023 12:00:00'),
  });
  const post = await con.getRepository(ArticlePost).findOneBy({ id: 'p1' });
  expect(post.metadataChangedAt).toEqual(new Date('2023-01-05T12:00:00.000Z'));
  expect(post.visible).toEqual(false);
});

it('should update the post and make it visible if title is available', async () => {
  await expectSuccessfulBackground(worker, {
    post_id: 'p1',
    updated_at: new Date('01-05-2023 12:00:00'),
    title: 'test',
  });
  const post = await con.getRepository(ArticlePost).findOneBy({ id: 'p1' });
  expect(post.metadataChangedAt).toEqual(new Date('2023-01-05T12:00:00.000Z'));
  expect(post.visible).toEqual(true);
  expect(post.visibleAt).toEqual(new Date('2023-01-05T12:00:00.000Z'));
  expect(post.title).toEqual('test');
});

it('should update the post related shared post to visible', async () => {
  await createSharedPost();
  await expectSuccessfulBackground(worker, {
    post_id: 'p1',
    updated_at: new Date('01-05-2023 12:00:00'),
    title: 'test',
  });
  const post = await con.getRepository(ArticlePost).findOneBy({ id: 'p1' });
  expect(post.metadataChangedAt).toEqual(new Date('2023-01-05T12:00:00.000Z'));
  expect(post.visible).toEqual(true);
  expect(post.visibleAt).toEqual(new Date('2023-01-05T12:00:00.000Z'));
  expect(post.title).toEqual('test');
  const sharedPost = await con
    .getRepository(SharePost)
    .findOneBy({ id: 'sp1' });
  expect(sharedPost.visible).toEqual(true);
  expect(sharedPost.visibleAt).toEqual(new Date('2023-01-05T12:00:00.000Z'));
});

it('should save a new post with the relevant keywords', async () => {
  await createDefaultKeywords();
  await expectSuccessfulBackground(worker, {
    post_id: 'p1',
    updated_at: new Date('01-05-2023 12:00:00'),
    title: 'test',
    extra: {
      keywords: ['alpine', 'a-b-testing', 'mongodb'],
    },
  });
  const post = await con.getRepository(ArticlePost).findOneBy({ id: 'p1' });
  expect(post.metadataChangedAt).toEqual(new Date('2023-01-05T12:00:00.000Z'));
  expect(post.visible).toEqual(true);
  expect(post.visibleAt).toEqual(new Date('2023-01-05T12:00:00.000Z'));
  expect(post.title).toEqual('test');
  expect(post.tagsStr).toEqual('mongodb,alpinejs,ab-testing');
  const keywords = await con.getRepository(Keyword).find({
    where: {
      value: 'alpine',
    },
  });
  // since I am adding a post which has `alpine`
  // as a tag, occurences of `alpine` in the db
  // should increase from 1 to 2
  expect(keywords[0].occurrences).toEqual(2);
});
