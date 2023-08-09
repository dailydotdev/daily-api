import cron from '../../src/cron/updateTrending';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { ArticlePost, Post, Source, View } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture, sharedPostsFixture } from '../fixture/post';

import { DeepPartial } from 'typeorm/common/DeepPartial';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
  await saveFixtures(con, ArticlePost, sharedPostsFixture);
});

const addViewsToPost = async (
  postId: string,
  count: number,
  now: Date,
): Promise<void> => {
  await con.getRepository(View).save(
    [...new Array(count)].map(
      (val, index): DeepPartial<View> => ({
        postId,
        userId: index.toString(),
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
  await expectSuccessfulCron(cron);
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
  await expectSuccessfulCron(cron);
  const post = await con.getRepository(Post).findOne({
    select: ['id', 'trending'],
    where: { id: postsFixture[0].id },
  });
  expect(post.trending).toEqual(null);
});
