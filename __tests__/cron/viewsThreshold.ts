import { Connection, getConnection } from 'typeorm';

import cron from '../../src/cron/viewsThreshold';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { Post, Source } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
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
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
});

it('should not update anything', async () => {
  await con
    .getRepository(Post)
    .update({ id: 'p1' }, { views: 300, viewsThreshold: 1 });
  await con
    .getRepository(Post)
    .update({ id: 'p2' }, { views: 600, viewsThreshold: 2 });
  await expectSuccessfulCron(app, cron);
  const posts = await con.getRepository(Post).find({
    select: ['id', 'viewsThreshold'],
    order: { id: 'ASC' },
  });
  expect(posts).toMatchSnapshot();
});

it('should update 3 posts that reached views threshold', async () => {
  await con
    .getRepository(Post)
    .update({ id: 'p1' }, { views: 300, viewsThreshold: 0 });
  await con
    .getRepository(Post)
    .update({ id: 'p2' }, { views: 600, viewsThreshold: 0 });
  await con
    .getRepository(Post)
    .update({ id: 'p3' }, { views: 600, viewsThreshold: 1 });
  await expectSuccessfulCron(app, cron);
  const posts = await con.getRepository(Post).find({
    select: ['id', 'viewsThreshold'],
    order: { id: 'ASC' },
  });
  expect(posts).toMatchSnapshot();
});
