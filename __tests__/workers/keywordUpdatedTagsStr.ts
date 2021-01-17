import { Connection, getConnection } from 'typeorm';
import { FastifyInstance } from 'fastify';
import appFunc from '../../src/background';
import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/keywordUpdatedTagsStr';
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

it('should update post tagsStr when keyword status changes', async () => {
  await con.getRepository(Keyword).save([
    { value: 'java', occurrences: 20 },
    { value: 'javascript', occurrences: 10, status: 'allow' },
    { value: 'nodejs', status: 'deny' },
  ]);
  await con.getRepository(PostKeyword).save([
    { keyword: 'java', postId: 'p1' },
    { keyword: 'javascript', postId: 'p1' },
    { keyword: 'nodejs', postId: 'p1' },
    { keyword: 'java', postId: 'p2' },
    { keyword: 'javascript', postId: 'p3' },
  ]);
  await expectSuccessfulBackground(app, worker, {
    keyword: 'java',
  });
  const posts = await con.getRepository(Post).find({
    select: ['id', 'tagsStr'],
    order: { id: 'ASC' },
  });
  expect(posts).toMatchSnapshot();
});
