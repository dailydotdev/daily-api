import { DataSource } from 'typeorm';
import { saveFixtures } from '../helpers';
import createOrGetConnection from '../../src/db';
import { ArticlePost, PostTag, Source, User } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture, postTagsFixture } from '../fixture/post';
import { getPostsTinybirdExport } from '../../src/cron/exportToTinybird';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.clearAllMocks();

  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
  await saveFixtures(con, PostTag, postTagsFixture);
  await con
    .getRepository(User)
    .save({ id: '1', name: 'Ido', image: 'https://daily.dev/ido.jpg' });
  await con.getRepository(User).save({
    id: '2',
    name: 'Lee',
    image: 'https://daily.dev/lee.jpg',
  });
});

describe('getPostsTinybirdExport function', () => {
  it('should return posts to export to tinybird with specific properties', async () => {
    const now = new Date();
    const latest = new Date(now.getTime() - 10000);
    const posts = await getPostsTinybirdExport(con, latest);
    posts.forEach((post) => {
      post.created_at = '';
      post.metadata_changed_at = '';
    });
    expect(posts.sort((a, b) => a.id > b.id)).toMatchSnapshot();
  });
});
