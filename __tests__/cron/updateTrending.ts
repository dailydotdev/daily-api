import { Connection, getConnection } from 'typeorm';
import shortid from 'shortid';

import cron from '../../src/cron/updateTrending';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { Post, Source, View } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
import { FastifyInstance } from 'fastify';
import appFunc from '../../src/background';
import { DeepPartial } from 'typeorm/common/DeepPartial';

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
});

const addViewsToPost = async (
  postId: string,
  count: number,
  now: Date,
): Promise<void> => {
  await con.getRepository(View).save(
    [...new Array(count)].map(
      (): DeepPartial<View> => ({
        postId,
        userId: shortid.generate(),
        timestamp: new Date(now.getTime() - Math.random() * 20 * 60 * 1000),
      }),
    ),
  );
};

it('should update the trending score of the relevant articles', async () => {
  const now = new Date();
  const halfHour = new Date(now.getTime() - 30 * 60 * 1000);
  const hour = new Date(now.getTime() - 60 * 60 * 1000);
  await Promise.all([
    con.getRepository(Post).update(postsFixture[0].id, { createdAt: hour }),
    con.getRepository(Post).update(postsFixture[2].id, { createdAt: hour }),
    addViewsToPost(postsFixture[0].id, 80, now),
    addViewsToPost(postsFixture[0].id, 20, halfHour),
    addViewsToPost(postsFixture[1].id, 10, now),
    addViewsToPost(postsFixture[1].id, 3, halfHour),
    addViewsToPost(postsFixture[2].id, 170, now),
    addViewsToPost(postsFixture[2].id, 30, halfHour),
  ]);
  await expectSuccessfulCron(app, cron);
  const posts = await con
    .getRepository(Post)
    .find({ select: ['id', 'trending'], order: { id: 'ASC' } });
  expect(posts).toMatchSnapshot();
  const trendingPost = await con.getRepository(Post).findOne({
    select: ['id', 'lastTrending'],
    where: { id: postsFixture[0].id },
  });
  expect(trendingPost.lastTrending).toBeTruthy();
});

it('should set trending to null when no longer trending', async () => {
  const now = new Date();
  await Promise.all([
    addViewsToPost(
      postsFixture[0].id,
      100,
      new Date(now.getTime() - 120 * 60 * 1000),
    ),
    con.getRepository(Post).update(postsFixture[0].id, {
      trending: 150,
      lastTrending: new Date(now.getTime() - 60 * 60 * 1000),
    }),
  ]);
  await expectSuccessfulCron(app, cron);
  const post = await con.getRepository(Post).findOne({
    select: ['id', 'trending'],
    where: { id: postsFixture[0].id },
  });
  expect(post.trending).toEqual(null);
});
