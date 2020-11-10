import { Connection, getConnection } from 'typeorm';

import cron from '../../src/cron/updateTags';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { Post, PostTag, Source, TagCount } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture, postTagsFixture } from '../fixture/post';
import { FastifyInstance } from 'fastify';
import appFunc from '../../src/background';

let con: Connection;
let app: FastifyInstance;

beforeAll(async () => {
  con = await getConnection();
  app = await appFunc();
  return app.ready();
});

beforeEach(async () => {
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
  await saveFixtures(con, PostTag, postTagsFixture);
});

it('should update tags count of posts from the last 180 days', async () => {
  const now = new Date();
  await saveFixtures(con, Post, [
    {
      id: 'p100',
      shortId: 'p100',
      title: 'P100',
      url: 'http://p100.com',
      score: 0,
      sourceId: 'a',
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 200),
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
  await expectSuccessfulCron(app, cron);
  const counts = await con
    .getRepository(TagCount)
    .find({ order: { tag: 'ASC' } });
  expect(counts).toMatchSnapshot();
});
