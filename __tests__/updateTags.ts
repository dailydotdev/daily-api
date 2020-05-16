import { Connection, getConnection } from 'typeorm';

import cron from '../src/cron/updateTags';
import { saveFixtures } from './helpers';
import { Post, PostTag, Source, TagCount } from '../src/entity';
import { sourcesFixture } from './fixture/source';
import { postsFixture, postTagsFixture } from './fixture/post';

let con: Connection;

beforeAll(async () => {
  con = await getConnection();
});

beforeEach(async () => {
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
  await saveFixtures(con, PostTag, postTagsFixture);
});

it('should update tags count of posts from the last 30 days', async () => {
  const now = new Date();
  await saveFixtures(con, Post, [
    {
      id: 'p100',
      title: 'P100',
      url: 'http://p100.com',
      score: 0,
      sourceId: 'a',
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 50),
    },
  ]);
  await saveFixtures(con, PostTag, [
    {
      postId: 'p100',
      tag: 'webdev',
    },
    {
      postId: 'p100',
      tag: 'javascript',
    },
  ]);
  await cron.handler(con);
  const counts = await con
    .getRepository(TagCount)
    .find({ order: { tag: 'ASC' } });
  expect(counts).toMatchSnapshot();
});
