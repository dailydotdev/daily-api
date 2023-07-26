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
    const snapshot = [
      {
        author_id: null,
        banned: 0,
        content_curation: [],
        created_at: '',
        creator_twitter: null,
        id: 'p1',
        metadata_changed_at: '',
        post_private: 0,
        post_type: 'article',
        source_id: 'a',
        source_type: 'Source',
        tags_str: 'javascript,webdev',
      },
      {
        author_id: null,
        banned: 0,
        content_curation: [],
        created_at: '',
        creator_twitter: null,
        id: 'p2',
        metadata_changed_at: '',
        post_private: 0,
        post_type: 'article',
        source_id: 'b',
        source_type: 'Source',
        tags_str: null,
      },
      {
        author_id: null,
        banned: 0,
        content_curation: [],
        created_at: '',
        creator_twitter: null,
        id: 'p3',
        metadata_changed_at: '',
        post_private: 0,
        post_type: 'article',
        source_id: 'c',
        source_type: 'Source',
        tags_str: null,
      },
      {
        author_id: null,
        banned: 0,
        content_curation: [],
        created_at: '',
        creator_twitter: null,
        id: 'p4',
        metadata_changed_at: '',
        post_private: 0,
        post_type: 'article',
        source_id: 'a',
        source_type: 'Source',
        tags_str: 'backend,data,javascript',
      },
      {
        author_id: null,
        banned: 0,
        content_curation: [],
        created_at: '',
        creator_twitter: null,
        id: 'p5',
        metadata_changed_at: '',
        post_private: 0,
        post_type: 'article',
        source_id: 'b',
        source_type: 'Source',
        tags_str: 'html,javascript',
      },
      {
        author_id: null,
        banned: 0,
        content_curation: [],
        created_at: '',
        creator_twitter: null,
        id: 'p6',
        metadata_changed_at: '',
        post_private: 1,
        post_type: 'article',
        source_id: 'p',
        source_type: 'Source',
        tags_str: null,
      },
      {
        author_id: null,
        banned: 0,
        content_curation: [],
        created_at: '',
        creator_twitter: null,
        id: 'squadP1',
        metadata_changed_at: '',
        post_private: 1,
        post_type: 'article',
        source_id: 'squad',
        source_type: 'Source',
        tags_str: null,
      },
    ];

    const now = new Date();
    const latest = new Date(now.getTime() - 10000);
    const posts = await getPostsTinybirdExport(con, latest);
    posts.forEach((post) => {
      post.created_at = '';
      post.metadata_changed_at = '';
    });
    posts.forEach((post) => expect(snapshot).toContainEqual(post));
  });
});
