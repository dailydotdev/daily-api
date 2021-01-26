import { Connection, getConnection } from 'typeorm';
import { FastifyInstance } from 'fastify';
import appFunc from '../../src/background';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import cron from '../../src/cron/updateTagsStr';
import {
  Keyword,
  Post,
  PostKeyword,
  Source,
  SourceDisplay,
} from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { sourceDisplaysFixture } from '../fixture/sourceDisplay';
import { postsFixture } from '../fixture/post';
import { Checkpoint } from '../../src/entity/Checkpoint';

let con: Connection;
let app: FastifyInstance;

beforeAll(async () => {
  con = await getConnection();
  app = await appFunc();
  return app.ready();
});

beforeEach(async () => {
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, SourceDisplay, sourceDisplaysFixture);
  await saveFixtures(con, Post, postsFixture);
});

afterAll(() => app.close());

it('should update post tagsStr with the all recently updated keywords', async () => {
  const now = new Date();
  const checkpoint = new Date(now.getTime() - 1000 * 600);
  const before = new Date(checkpoint.getTime() - 1000 * 600);
  await con.getRepository(Checkpoint).save({
    key: 'last_tags_str_update',
    timestamp: checkpoint,
  });
  await con.getRepository(Keyword).save([
    { value: 'java', occurrences: 20 },
    { value: 'javascript', occurrences: 10, status: 'allow' },
    { value: 'nodejs', status: 'deny' },
    { value: 'webdev', status: 'allow' },
  ]);
  await con.getRepository(PostKeyword).save([
    { keyword: 'java', postId: 'p1' },
    { keyword: 'javascript', postId: 'p1' },
    { keyword: 'nodejs', postId: 'p1' },
    { keyword: 'java', postId: 'p2' },
    { keyword: 'javascript', postId: 'p3' },
    { keyword: 'webdev', postId: 'p4' },
  ]);
  await con.query(
    `update keyword set "updatedAt" = $1 where "value" = 'webdev'`,
    [before],
  );
  await expectSuccessfulCron(app, cron);
  const posts = await con.getRepository(Post).find({
    select: ['id', 'tagsStr'],
    order: { id: 'ASC' },
  });
  expect(posts).toMatchSnapshot();
});
