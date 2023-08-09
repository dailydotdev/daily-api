import { expectSuccessfulCron, saveFixtures } from '../helpers';
import cron from '../../src/cron/updateTagsStr';
import {
  ArticlePost,
  Keyword,
  Post,
  PostKeyword,
  Source,
} from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture, sharedPostsFixture } from '../fixture/post';
import { Checkpoint } from '../../src/entity/Checkpoint';
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
    `update keyword
     set "updatedAt" = $1
     where "value" = 'webdev'`,
    [before],
  );
  await expectSuccessfulCron(cron);
  const posts = await con.getRepository(Post).find({
    select: ['id', 'tagsStr'],
    order: { id: 'ASC' },
  });
  expect(posts).toMatchSnapshot();
});
