import { FastifyInstance } from 'fastify';
import appFunc from '../src';
import request from 'supertest';
import nock from 'nock';
import { saveFixtures } from './helpers';
import { DataSource, DeepPartial } from 'typeorm';
import createOrGetConnection from '../src/db';
import {
  AGENTS_DIGEST_SOURCE,
  Archive,
  CollectionPost,
  Keyword,
  KeywordStatus,
  Post,
  PostType,
  SentimentEntity,
  SentimentGroup,
  SharePost,
  SocialTwitterPost,
  Source,
  SourceType,
  User,
} from '../src/entity';
import { BriefPost } from '../src/entity/posts/BriefPost';
import {
  ArchivePeriodType,
  ArchiveRankingType,
  ArchiveScopeType,
  ArchiveSubjectType,
} from '../src/common/archive';
import { getSitemapRowLastmod } from '../src/routes/sitemaps';
import { updateFlagsStatement } from '../src/common/utils';
import { sourcesFixture } from './fixture/source';
import { keywordsFixture } from './fixture/keywords';
import { ONE_DAY_IN_SECONDS } from '../src/common/constants';
let app: FastifyInstance;
let con: DataSource;
const previousSitemapLimit = process.env.SITEMAP_LIMIT;

const now = new Date();
const postsFixture: DeepPartial<Post>[] = [
  {
    id: 'p1',
    shortId: 'p1',
    title: 'P1',
    sourceId: 'a',
    createdAt: now,
    type: PostType.Article,
    upvotes: 20,
  },
  {
    id: 'p2',
    shortId: 'p2',
    title: 'P2',
    sourceId: 'b',
    banned: true,
    createdAt: new Date(now.getTime() - 1000),
    type: PostType.Article,
  },
  {
    id: 'p3',
    shortId: 'p3',
    title: 'P3',
    sourceId: 'c',
    private: true,
    createdAt: new Date(now.getTime() - 2000),
    type: PostType.Collection,
  },
  {
    id: 'p4',
    shortId: 'p4',
    title: 'P4',
    sourceId: 'a',
    createdAt: new Date(now.getTime() - 3000),
    type: PostType.Article,
    upvotes: 80,
  },
  {
    id: 'p5',
    shortId: 'p5',
    title: 'P5',
    sourceId: 'b',
    createdAt: new Date(now.getTime() - 4000),
    type: PostType.Collection,
  },
];

const sentimentGroupsFixture: DeepPartial<SentimentGroup>[] = [
  {
    id: '385404b4-f0f4-4e81-a338-bdca851eca31',
    name: 'Coding Agents',
  },
  {
    id: '970ab2c9-f845-4822-82f0-02169713b814',
    name: 'LLMs',
  },
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Other Group',
  },
];

const sentimentEntitiesFixture: DeepPartial<SentimentEntity>[] = [
  {
    groupId: '385404b4-f0f4-4e81-a338-bdca851eca31',
    entity: 'claude_code',
    name: 'Claude Code',
    logo: 'https://example.com/claude.png',
  },
  {
    groupId: '970ab2c9-f845-4822-82f0-02169713b814',
    entity: 'gpt_4_1',
    name: 'GPT 4.1',
    logo: 'https://example.com/gpt.png',
  },
  {
    groupId: '11111111-1111-1111-1111-111111111111',
    entity: 'not_in_arena',
    name: 'Not In Arena',
    logo: 'https://example.com/other.png',
  },
];

const createSourcePostFixtures = (
  sourceId: string,
  count: number,
  prefix: string,
  overrides?: (index: number) => DeepPartial<Post>,
): DeepPartial<Post>[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index}`,
    shortId: `${prefix.replace(/[^a-z0-9]/gi, '').slice(0, 10)}${index}`,
    title: `${prefix} ${index}`,
    sourceId,
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    type: PostType.Article,
    visible: true,
    private: false,
    deleted: false,
    banned: false,
    ...overrides?.(index),
  }));

beforeAll(async () => {
  process.env.SITEMAP_LIMIT = '2';
  con = await createOrGetConnection();
  app = await appFunc();
  return app.ready();
});

beforeEach(async () => {
  nock.cleanAll();
  await saveFixtures(con, SentimentGroup, sentimentGroupsFixture);
  await saveFixtures(con, SentimentEntity, sentimentEntitiesFixture);
  await saveFixtures(con, Keyword, keywordsFixture);
  await saveFixtures(con, Source, sourcesFixture);
  await con.getRepository(Post).insert(postsFixture);
});

afterAll(async () => {
  if (previousSitemapLimit) {
    process.env.SITEMAP_LIMIT = previousSitemapLimit;
  } else {
    delete process.env.SITEMAP_LIMIT;
  }

  await app.close();
});

describe('GET /sitemaps/posts.txt', () => {
  it('should return posts ordered by time', async () => {
    const res = await request(app.server)
      .get('/sitemaps/posts.txt')
      .expect(200);
    expect(res.header['content-type']).toEqual('text/plain');
    expect(res.header['cache-control']).toBeTruthy();
    expect(res.text).toEqual(`http://localhost:5002/posts/p5-p5
http://localhost:5002/posts/p4-p4
http://localhost:5002/posts/p1-p1
`);
  });
});

describe('GET /sitemaps/posts.xml', () => {
  it('should return the first posts sitemap page as xml', async () => {
    const res = await request(app.server)
      .get('/sitemaps/posts.xml')
      .expect(200);

    expect(res.header['content-type']).toContain('application/xml');
    expect(res.header['cache-control']).toBeTruthy();
    expect(res.text).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    );
    expect(res.text).toContain('<loc>http://localhost:5002/posts/p5-p5</loc>');
    expect(res.text).toContain('<loc>http://localhost:5002/posts/p4-p4</loc>');
    expect(res.text).not.toContain(
      '<loc>http://localhost:5002/posts/p1-p1</loc>',
    );
    expect(res.text).not.toContain('/posts/p2-p2');
    expect(res.text).not.toContain('/posts/p3-p3');
  });
});

describe('GET /sitemaps/posts-:page.xml', () => {
  it('should return subsequent paginated post sitemap pages', async () => {
    const res = await request(app.server)
      .get('/sitemaps/posts-2.xml')
      .expect(200);

    expect(res.header['content-type']).toContain('application/xml');
    expect(res.header['cache-control']).toBeTruthy();
    expect(res.text).toContain('<loc>http://localhost:5002/posts/p1-p1</loc>');
    expect(res.text).not.toContain(
      '<loc>http://localhost:5002/posts/p5-p5</loc>',
    );
    expect(res.text).not.toContain(
      '<loc>http://localhost:5002/posts/p4-p4</loc>',
    );
  });

  it('should keep earlier pages static and only append equal-timestamp posts to the latest page', async () => {
    await con.getRepository(Post).insert({
      id: 'p6',
      shortId: 'p6',
      title: 'P6',
      sourceId: 'a',
      createdAt: now,
      type: PostType.Article,
    });

    const firstPage = await request(app.server)
      .get('/sitemaps/posts-1.xml')
      .expect(200);
    const secondPage = await request(app.server)
      .get('/sitemaps/posts-2.xml')
      .expect(200);

    expect(firstPage.text).toContain(
      '<loc>http://localhost:5002/posts/p5-p5</loc>',
    );
    expect(firstPage.text).toContain(
      '<loc>http://localhost:5002/posts/p4-p4</loc>',
    );
    expect(firstPage.text).not.toContain(
      '<loc>http://localhost:5002/posts/p1-p1</loc>',
    );
    expect(firstPage.text).not.toContain(
      '<loc>http://localhost:5002/posts/p6-p6</loc>',
    );
    expect(secondPage.text).toContain(
      '<loc>http://localhost:5002/posts/p1-p1</loc>',
    );
    expect(secondPage.text).toContain(
      '<loc>http://localhost:5002/posts/p6-p6</loc>',
    );
  });

  it('should return 404 for paginated pages with no rows', async () => {
    await request(app.server).get('/sitemaps/posts-3.xml').expect(404);
  });
});

describe('GET /sitemaps/posts.xml (type filtering)', () => {
  it('should exclude noindex post types and collection posts', async () => {
    const postBase = { sourceId: 'a', createdAt: now };

    await con.getRepository(BriefPost).insert({
      ...postBase,
      id: 'brief-post',
      shortId: 'bp1',
      title: 'Brief Post',
    });
    await con.getRepository(SocialTwitterPost).insert({
      ...postBase,
      id: 'social-post',
      shortId: 'sp1',
      title: 'Social Post',
    });
    await con.getRepository(SharePost).insert({
      ...postBase,
      id: 'share-post',
      shortId: 'shp',
      title: 'Share Post',
      sharedPostId: 'p1',
    });
    await con.getRepository(CollectionPost).insert({
      ...postBase,
      id: 'collection-sitemap',
      shortId: 'csm',
      title: 'Collection Sitemap',
      visible: true,
      upvotes: 5,
      collectionSources: ['a', 'b', 'c'],
    });

    const res = await request(app.server)
      .get('/sitemaps/posts.xml')
      .expect(200);

    expect(res.text).not.toContain('/posts/brief-post');
    expect(res.text).not.toContain('/posts/social-post');
    expect(res.text).not.toContain('/posts/share-post');
    expect(res.text).not.toContain('/posts/collection-sitemap');
    expect(res.text).toContain('/posts/p4-p4');
  });

  it('should exclude non-visible posts', async () => {
    await con.getRepository(Post).insert({
      id: 'hidden-post',
      shortId: 'hp1',
      title: 'Hidden Post',
      sourceId: 'a',
      createdAt: now,
      visible: false,
    });

    const res = await request(app.server)
      .get('/sitemaps/posts.xml')
      .expect(200);

    expect(res.text).not.toContain('/posts/hidden-post');
  });
});

describe('GET /sitemaps/collections.xml', () => {
  it('should return only qualified public collections ordered by time as xml', async () => {
    const updatedAt = new Date('2024-02-01T12:00:00.123Z');

    await con.getRepository(CollectionPost).insert([
      {
        id: 'qc1',
        shortId: 'qc1',
        title: 'Qualified Collection',
        sourceId: 'a',
        type: PostType.Collection,
        visible: true,
        upvotes: 3,
        collectionSources: ['a', 'b', 'c'],
        metadataChangedAt: updatedAt,
        createdAt: new Date('2024-02-01T12:00:02.000Z'),
      },
      {
        id: 'qc0',
        shortId: 'qc0',
        title: 'Earlier Qualified Collection',
        sourceId: 'a',
        type: PostType.Collection,
        visible: true,
        upvotes: 50,
        collectionSources: ['a', 'b', 'c'],
        metadataChangedAt: updatedAt,
        createdAt: new Date('2024-02-01T12:00:01.000Z'),
      },
      {
        id: 'low-upvote-collection',
        shortId: 'luc',
        title: 'Low Upvote Collection',
        sourceId: 'a',
        type: PostType.Collection,
        visible: true,
        upvotes: 0,
        collectionSources: ['a', 'b', 'c'],
      },
      {
        id: 'small-collection',
        shortId: 'sc1',
        title: 'Small Collection',
        sourceId: 'a',
        type: PostType.Collection,
        visible: true,
        upvotes: 4,
        collectionSources: ['a', 'b'],
      },
      {
        id: 'hidden-collection',
        shortId: 'hc1',
        title: 'Hidden Collection',
        sourceId: 'a',
        type: PostType.Collection,
        visible: false,
        upvotes: 4,
        collectionSources: ['a', 'b', 'c'],
      },
      {
        id: 'deleted-collection',
        shortId: 'dc1',
        title: 'Deleted Collection',
        sourceId: 'a',
        type: PostType.Collection,
        visible: true,
        deleted: true,
        upvotes: 4,
        collectionSources: ['a', 'b', 'c'],
      },
    ]);

    const res = await request(app.server)
      .get('/sitemaps/collections.xml')
      .expect(200);

    expect(res.header['content-type']).toContain('application/xml');
    expect(res.header['cache-control']).toBeTruthy();
    expect(res.text).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    );
    expect(res.text).toContain(
      '<loc>http://localhost:5002/posts/qualified-collection-qc1</loc>',
    );
    expect(res.text).toContain(
      '<loc>http://localhost:5002/posts/earlier-qualified-collection-qc0</loc>',
    );
    expect(res.text).toContain('<lastmod>2024-02-01T12:00:00.123Z</lastmod>');
    expect(res.text).not.toContain('/posts/low-upvote-collection-luc');
    expect(res.text).not.toContain('/posts/small-collection-sc1');
    expect(res.text).not.toContain('/posts/hidden-collection-hc1');
    expect(res.text).not.toContain('/posts/deleted-collection-dc1');
    expect(res.text).not.toContain('/posts/p3-p3');
    expect(
      res.text.indexOf(
        '<loc>http://localhost:5002/posts/earlier-qualified-collection-qc0</loc>',
      ),
    ).toBeLessThan(
      res.text.indexOf(
        '<loc>http://localhost:5002/posts/qualified-collection-qc1</loc>',
      ),
    );
  });
});

describe('GET /sitemaps/tags.txt', () => {
  it('should return tags ordered alphabetically', async () => {
    const res = await request(app.server).get('/sitemaps/tags.txt').expect(200);
    expect(res.header['content-type']).toEqual('text/plain');
    expect(res.header['cache-control']).toBeTruthy();
    expect(res.text).toEqual(`http://localhost:5002/tags/development
http://localhost:5002/tags/fullstack
http://localhost:5002/tags/golang
http://localhost:5002/tags/rust
http://localhost:5002/tags/webdev
`);
  });
});

describe('GET /sitemaps/tags.xml', () => {
  it('should return tags sitemap as xml', async () => {
    await con.getRepository(Keyword).save({
      value: 'web&ai',
      occurrences: 1,
      status: KeywordStatus.Allow,
    });

    const res = await request(app.server).get('/sitemaps/tags.xml').expect(200);

    expect(res.header['content-type']).toContain('application/xml');
    expect(res.header['cache-control']).toBeTruthy();
    expect(res.text).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    );
    expect(res.text).toContain(
      '<loc>http://localhost:5002/tags/development</loc>',
    );
    expect(res.text).toContain('<loc>http://localhost:5002/tags/webdev</loc>');
    expect(res.text).toContain(
      '<loc>http://localhost:5002/tags/web%26ai</loc>',
    );
    expect(res.text).not.toContain('/tags/web-development');
    expect(res.text).not.toContain('/tags/politics');
    expect(res.text).not.toContain('/tags/pending');
  });
});

describe('GET /sitemaps/index.xml', () => {
  it('should return sitemap index xml with all paginated post sitemaps', async () => {
    const oldDate = new Date(now.getTime() - 91 * ONE_DAY_IN_SECONDS * 1000);

    await con.getRepository(Post).insert([
      {
        id: 'evergreen-index-1',
        shortId: 'ei1',
        title: 'Evergreen Index 1',
        sourceId: 'a',
        createdAt: oldDate,
        type: PostType.Article,
        upvotes: 10,
      },
      {
        id: 'evergreen-index-2',
        shortId: 'ei2',
        title: 'Evergreen Index 2',
        sourceId: 'a',
        createdAt: new Date(oldDate.getTime() - 1000),
        type: PostType.Article,
        upvotes: 11,
      },
      {
        id: 'evergreen-index-3',
        shortId: 'ei3',
        title: 'Evergreen Index 3',
        sourceId: 'a',
        createdAt: new Date(oldDate.getTime() - 2000),
        type: PostType.Article,
        upvotes: 12,
      },
    ]);

    const res = await request(app.server)
      .get('/sitemaps/index.xml')
      .expect(200);

    expect(res.header['content-type']).toContain('application/xml');
    expect(res.header['cache-control']).toBeTruthy();
    expect(res.text).toContain(
      '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    );
    expect(res.text).toContain(
      '<loc>http://localhost:5002/api/sitemaps/posts-1.xml</loc>',
    );
    expect(res.text).toContain(
      '<loc>http://localhost:5002/api/sitemaps/posts-2.xml</loc>',
    );
    expect(res.text).toContain(
      '<loc>http://localhost:5002/api/sitemaps/evergreen.xml</loc>',
    );
    expect(res.text).toContain(
      '<loc>http://localhost:5002/api/sitemaps/evergreen-2.xml</loc>',
    );
    expect(res.text).toContain(
      '<loc>http://localhost:5002/api/sitemaps/collections.xml</loc>',
    );
    expect(res.text).toContain(
      '<loc>http://localhost:5002/api/sitemaps/agents.xml</loc>',
    );
    expect(res.text).toContain(
      '<loc>http://localhost:5002/api/sitemaps/agents-digest.xml</loc>',
    );
    expect(res.text).toContain(
      '<loc>http://localhost:5002/api/sitemaps/sources.xml</loc>',
    );
    expect(res.text).toContain(
      '<loc>http://localhost:5002/api/sitemaps/squads.xml</loc>',
    );
    expect(res.text).toContain(
      '<loc>http://localhost:5002/api/sitemaps/users.xml</loc>',
    );
    expect(res.text).toContain(
      '<loc>http://localhost:5002/api/sitemaps/tags.xml</loc>',
    );
  });
});

describe('GET /sitemaps/sources.xml', () => {
  it('should include only qualified public machine sources', async () => {
    const sourceCreatedAt = new Date('2023-10-01T10:00:00.000Z');
    const recentActivityDate = new Date();

    await con.getRepository(Source).save([
      {
        id: 'qualified-source',
        name: 'Qualified Source',
        image: 'https://daily.dev/qualified-source.jpg',
        handle: 'qualifiedsource',
        type: SourceType.Machine,
        active: true,
        private: false,
        createdAt: sourceCreatedAt,
      },
      {
        id: 'not-enough-posts-source',
        name: 'Not Enough Posts Source',
        image: 'https://daily.dev/not-enough-posts-source.jpg',
        handle: 'notenoughposts',
        type: SourceType.Machine,
        active: true,
        private: false,
      },
      {
        id: 'stale-source',
        name: 'Stale Source',
        image: 'https://daily.dev/stale-source.jpg',
        handle: 'stalesource',
        type: SourceType.Machine,
        active: true,
        private: false,
      },
      {
        id: 'private-source',
        name: 'Private Source',
        image: 'https://daily.dev/private-source.jpg',
        handle: 'privatesource',
        type: SourceType.Machine,
        active: true,
        private: true,
      },
      {
        id: 'inactive-source',
        name: 'Inactive Source',
        image: 'https://daily.dev/inactive-source.jpg',
        handle: 'inactivesource',
        type: SourceType.Machine,
        active: false,
        private: false,
      },
      {
        id: 'squad-source',
        name: 'Squad Source',
        image: 'https://daily.dev/squad-source.jpg',
        handle: 'squadsource',
        type: SourceType.Squad,
        active: true,
        private: false,
      },
    ]);

    await con.getRepository(Post).insert([
      ...createSourcePostFixtures(
        'qualified-source',
        9,
        'qualified-old',
        () => ({}),
      ),
      ...createSourcePostFixtures(
        'qualified-source',
        1,
        'qualified-recent',
        () => ({
          createdAt: recentActivityDate,
        }),
      ),
      ...createSourcePostFixtures(
        'not-enough-posts-source',
        9,
        'notenough',
        () => ({}),
      ),
      ...createSourcePostFixtures(
        'not-enough-posts-source',
        1,
        'notenough-private',
        () => ({ private: true }),
      ),
      ...createSourcePostFixtures('stale-source', 10, 'stale', () => ({})),
      ...createSourcePostFixtures('private-source', 10, 'private', () => ({
        createdAt: recentActivityDate,
      })),
      ...createSourcePostFixtures('inactive-source', 10, 'inactive', () => ({
        createdAt: recentActivityDate,
      })),
      ...createSourcePostFixtures('squad-source', 10, 'squad', () => ({
        createdAt: recentActivityDate,
      })),
    ]);

    const res = await request(app.server)
      .get('/sitemaps/sources.xml')
      .expect(200);

    expect(res.header['content-type']).toContain('application/xml');
    expect(res.header['cache-control']).toEqual(
      'public, max-age=7200, s-maxage=7200',
    );
    expect(res.text).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    );
    expect(res.text).toContain(
      '<loc>http://localhost:5002/sources/qualifiedsource</loc>',
    );
    expect(res.text).toContain('<lastmod>2023-10-01T10:00:00.000Z</lastmod>');
    expect(res.text).not.toContain('/sources/notenoughposts');
    expect(res.text).not.toContain('/sources/stalesource');
    expect(res.text).not.toContain('/sources/privatesource');
    expect(res.text).not.toContain('/sources/inactivesource');
    expect(res.text).not.toContain('/sources/squadsource');
  });
});

describe('GET /sitemaps/users.xml', () => {
  it('should include only qualified author profiles', async () => {
    const updatedAt = new Date('2024-01-01T12:00:00.123Z');
    const userBase = {
      createdAt: now,
      infoConfirmed: true,
      reputation: 20,
    };
    const publicPostBase = {
      sourceId: 'a',
      createdAt: now,
      type: PostType.Article,
      visible: true,
      private: false,
      deleted: false,
    };

    await con.getRepository(User).save([
      {
        ...userBase,
        id: 'qualified-user',
        name: 'Qualified User',
        image: 'https://daily.dev/qualified.jpg',
        username: 'qualifieduser',
        email: 'qualified@test.com',
        updatedAt,
        reputation: 42,
        bio: 'Writes public posts',
      },
      {
        ...userBase,
        id: 'low-rep-user',
        name: 'Low Rep User',
        image: 'https://daily.dev/low-rep.jpg',
        username: 'lowrepuser',
        email: 'lowrep@test.com',
        reputation: 10,
        bio: 'Below threshold',
      },
      {
        ...userBase,
        id: 'empty-bio-user',
        name: 'Empty Bio User',
        image: 'https://daily.dev/empty-bio.jpg',
        username: 'emptybio',
        email: 'emptybio@test.com',
        bio: '',
      },
      {
        ...userBase,
        id: 'null-bio-user',
        name: 'Null Bio User',
        image: 'https://daily.dev/null-bio.jpg',
        username: 'nullbio',
        email: 'nullbio@test.com',
        bio: null,
      },
      {
        ...userBase,
        id: 'blank-bio-user',
        name: 'Blank Bio User',
        image: 'https://daily.dev/blank-bio.jpg',
        username: 'blankbio',
        email: 'blankbio@test.com',
        bio: '   ',
      },
      {
        ...userBase,
        id: 'missing-username-user',
        name: 'Missing Username User',
        image: 'https://daily.dev/no-username.jpg',
        email: 'nousername@test.com',
        bio: 'Has no username',
      },
      {
        ...userBase,
        id: 'private-post-user',
        name: 'Private Post User',
        image: 'https://daily.dev/private-post.jpg',
        username: 'privatepost',
        email: 'privatepost@test.com',
        bio: 'Only private posts',
      },
      {
        ...userBase,
        id: 'deleted-post-user',
        name: 'Deleted Post User',
        image: 'https://daily.dev/deleted-post.jpg',
        username: 'deletedpost',
        email: 'deletedpost@test.com',
        bio: 'Only deleted posts',
      },
      {
        ...userBase,
        id: 'hidden-post-user',
        name: 'Hidden Post User',
        image: 'https://daily.dev/hidden-post.jpg',
        username: 'hiddenpost',
        email: 'hiddenpost@test.com',
        bio: 'Only hidden posts',
      },
      {
        ...userBase,
        id: 'no-posts-user',
        name: 'No Posts User',
        image: 'https://daily.dev/no-posts.jpg',
        username: 'noposts',
        email: 'noposts@test.com',
        bio: 'Has no posts',
      },
    ]);

    await con.getRepository(Post).insert([
      {
        ...publicPostBase,
        id: 'qualified-user-post',
        shortId: 'qup',
        title: 'Qualified User Post',
        metadataChangedAt: updatedAt,
        authorId: 'qualified-user',
      },
      {
        ...publicPostBase,
        id: 'low-rep-post',
        shortId: 'lrp',
        title: 'Low Rep Post',
        authorId: 'low-rep-user',
      },
      {
        ...publicPostBase,
        id: 'empty-bio-post',
        shortId: 'ebp',
        title: 'Empty Bio Post',
        authorId: 'empty-bio-user',
      },
      {
        ...publicPostBase,
        id: 'null-bio-post',
        shortId: 'nbp',
        title: 'Null Bio Post',
        authorId: 'null-bio-user',
      },
      {
        ...publicPostBase,
        id: 'blank-bio-post',
        shortId: 'bbp',
        title: 'Blank Bio Post',
        authorId: 'blank-bio-user',
      },
      {
        ...publicPostBase,
        id: 'missing-username-post',
        shortId: 'mup',
        title: 'Missing Username Post',
        authorId: 'missing-username-user',
      },
      {
        ...publicPostBase,
        id: 'private-post-only',
        shortId: 'ppo',
        title: 'Private Post Only',
        authorId: 'private-post-user',
        private: true,
      },
      {
        ...publicPostBase,
        id: 'deleted-post-only',
        shortId: 'dpo',
        title: 'Deleted Post Only',
        authorId: 'deleted-post-user',
        deleted: true,
      },
      {
        ...publicPostBase,
        id: 'hidden-post-only',
        shortId: 'hpo',
        title: 'Hidden Post Only',
        authorId: 'hidden-post-user',
        visible: false,
      },
    ]);

    const res = await request(app.server)
      .get('/sitemaps/users.xml')
      .expect(200);

    expect(res.header['content-type']).toContain('application/xml');
    expect(res.header['cache-control']).toEqual(
      'public, max-age=7200, s-maxage=7200',
    );
    expect(res.text).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    );
    expect(res.text).toContain(
      '<loc>http://localhost:5002/qualifieduser</loc>',
    );
    expect(res.text).toContain('<lastmod>2024-01-01T12:00:00.123Z</lastmod>');
    expect(res.text).not.toContain('/lowrepuser');
    expect(res.text).not.toContain('/emptybio');
    expect(res.text).not.toContain('/nullbio');
    expect(res.text).not.toContain('/blankbio');
    expect(res.text).not.toContain('/privatepost');
    expect(res.text).not.toContain('/deletedpost');
    expect(res.text).not.toContain('/hiddenpost');
    expect(res.text).not.toContain('/noposts');
  });
});

describe('GET /sitemaps/agents.xml', () => {
  it('should return arena entity pages sitemap as xml', async () => {
    const res = await request(app.server)
      .get('/sitemaps/agents.xml')
      .expect(200);

    expect(res.header['content-type']).toContain('application/xml');
    expect(res.header['cache-control']).toBeTruthy();
    expect(res.text).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    );
    expect(res.text).toContain(
      '<loc>http://localhost:5002/agents/claude_code</loc>',
    );
    expect(res.text).toContain(
      '<loc>http://localhost:5002/agents/gpt_4_1</loc>',
    );
    expect(res.text).toContain('<lastmod>');
    expect(res.text).not.toContain('/agents/not_in_arena');
  });
});

describe('GET /sitemaps/agents-digest.xml', () => {
  it('should return agents digest posts sitemap as xml', async () => {
    await con.getRepository(Post).insert([
      {
        id: 'ad1',
        shortId: 'ad1',
        title: 'AD1',
        sourceId: AGENTS_DIGEST_SOURCE,
        createdAt: now,
        type: PostType.Digest,
      },
      {
        id: 'ad2',
        shortId: 'ad2',
        title: 'AD2',
        sourceId: AGENTS_DIGEST_SOURCE,
        createdAt: new Date(now.getTime() - 1000),
        type: PostType.Digest,
      },
      {
        id: 'ad3',
        shortId: 'ad3',
        title: 'AD3',
        sourceId: AGENTS_DIGEST_SOURCE,
        createdAt: new Date(now.getTime() - 2000),
        type: PostType.Digest,
        deleted: true,
      },
    ]);

    const res = await request(app.server)
      .get('/sitemaps/agents-digest.xml')
      .expect(200);

    expect(res.header['content-type']).toContain('application/xml');
    expect(res.header['cache-control']).toEqual(
      'public, max-age=7200, s-maxage=7200',
    );
    expect(res.text).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    );
    expect(res.text).toContain(
      '<loc>http://localhost:5002/posts/ad1-ad1</loc>',
    );
    expect(res.text).toContain(
      '<loc>http://localhost:5002/posts/ad2-ad2</loc>',
    );
    expect(res.text).toContain('<lastmod>');
    expect(res.text).not.toContain('/posts/ad3-ad3');
    expect(
      res.text.indexOf('<loc>http://localhost:5002/posts/ad1-ad1</loc>'),
    ).toBeLessThan(
      res.text.indexOf('<loc>http://localhost:5002/posts/ad2-ad2</loc>'),
    );
  });
});

describe('GET /sitemaps/squads.xml', () => {
  it('should return public squads with publicThreshold as xml sitemap', async () => {
    await con
      .getRepository(Source)
      .update(
        { id: 'm' },
        { flags: updateFlagsStatement<Source>({ publicThreshold: true }) },
      );

    const res = await request(app.server)
      .get('/sitemaps/squads.xml')
      .expect(200);

    expect(res.header['content-type']).toContain('application/xml');
    expect(res.header['cache-control']).toEqual(
      'public, max-age=7200, s-maxage=7200',
    );
    expect(res.text).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    );
    expect(res.text).toContain(
      '<loc>http://localhost:5002/squads/moderatedsquad</loc>',
    );
    expect(res.text).not.toContain('/squads/squad');
  });

  it('should exclude squads without publicThreshold', async () => {
    const res = await request(app.server)
      .get('/sitemaps/squads.xml')
      .expect(200);

    expect(res.text).not.toContain('/squads/moderatedsquad');
    expect(res.text).not.toContain('/squads/squad');
  });

  it('should exclude inactive squads even with publicThreshold', async () => {
    await con.getRepository(Source).update(
      { id: 'm' },
      {
        active: false,
        flags: updateFlagsStatement<Source>({ publicThreshold: true }),
      },
    );

    const res = await request(app.server)
      .get('/sitemaps/squads.xml')
      .expect(200);

    expect(res.text).not.toContain('/squads/moderatedsquad');
  });
});

describe('GET /sitemaps/evergreen.xml', () => {
  it('should include posts with at least 10 upvotes and paginate older posts', async () => {
    const oldDate = new Date(now.getTime() - 91 * ONE_DAY_IN_SECONDS * 1000);

    await con.getRepository(Post).insert([
      {
        id: 'evergreen-min-threshold',
        shortId: 'emt',
        title: 'Evergreen Min Threshold',
        sourceId: 'a',
        createdAt: oldDate,
        type: PostType.Article,
        upvotes: 10,
      },
      {
        id: 'evergreen-next-page',
        shortId: 'enp',
        title: 'Evergreen Next Page',
        sourceId: 'a',
        createdAt: new Date(oldDate.getTime() - 1000),
        type: PostType.Article,
        upvotes: 11,
      },
      {
        id: 'evergreen-third-page',
        shortId: 'etp',
        title: 'Evergreen Third Page',
        sourceId: 'a',
        createdAt: new Date(oldDate.getTime() - 2000),
        type: PostType.Article,
        upvotes: 12,
      },
      {
        id: 'evergreen-below-threshold',
        shortId: 'ebt',
        title: 'Evergreen Below Threshold',
        sourceId: 'a',
        createdAt: new Date(oldDate.getTime() - 3000),
        type: PostType.Article,
        upvotes: 9,
      },
    ]);

    const firstPage = await request(app.server)
      .get('/sitemaps/evergreen.xml')
      .expect(200);
    const secondPage = await request(app.server)
      .get('/sitemaps/evergreen-2.xml')
      .expect(200);

    expect(firstPage.header['content-type']).toContain('application/xml');
    expect(firstPage.text).toContain(
      '/posts/evergreen-third-page-evergreen-third-page',
    );
    expect(firstPage.text).toContain(
      '/posts/evergreen-next-page-evergreen-next-page',
    );
    expect(firstPage.text).not.toContain(
      '/posts/evergreen-min-threshold-evergreen-min-threshold',
    );
    expect(firstPage.text).not.toContain(
      '/posts/evergreen-below-threshold-ebt',
    );

    expect(secondPage.text).toContain(
      '/posts/evergreen-min-threshold-evergreen-min-threshold',
    );
    expect(secondPage.text).not.toContain(
      '/posts/evergreen-below-threshold-ebt',
    );
  });

  it('should exclude posts by low-reputation authors', async () => {
    await con.getRepository(User).save({
      id: 'low-rep-sitemap',
      name: 'Low Rep',
      image: 'https://daily.dev/low.jpg',
      username: 'lowrep',
      email: 'lowrep@test.com',
      createdAt: new Date(),
      infoConfirmed: true,
      reputation: 5,
    });

    const oldDate = new Date(now.getTime() - 91 * ONE_DAY_IN_SECONDS * 1000);

    await con.getRepository(Post).insert([
      {
        id: 'evergreen-lowrep',
        shortId: 'elr',
        title: 'Evergreen Low Rep',
        sourceId: 'a',
        createdAt: oldDate,
        type: PostType.Article,
        upvotes: 100,
        authorId: 'low-rep-sitemap',
      },
      {
        id: 'evergreen-norep',
        shortId: 'enr',
        title: 'Evergreen No Author',
        sourceId: 'a',
        createdAt: oldDate,
        type: PostType.Article,
        upvotes: 100,
      },
    ]);

    const res = await request(app.server)
      .get('/sitemaps/evergreen.xml')
      .expect(200);

    expect(res.header['content-type']).toContain('application/xml');
    expect(res.text).toContain('/posts/evergreen-no-author-evergreen-norep');
    expect(res.text).not.toContain('/posts/evergreen-low-rep-evergreen-lowrep');
  });

  it('should return 404 for paginated pages with no rows', async () => {
    await request(app.server).get('/sitemaps/evergreen-2.xml').expect(404);
  });
});

describe('GET /sitemaps/archive-index.xml', () => {
  const archiveBase = {
    subjectType: ArchiveSubjectType.Post,
    rankingType: ArchiveRankingType.Best,
  };

  it('should return index pages for global, tag, and source archives', async () => {
    const createdAt = new Date('2025-03-01T10:00:00.000Z');

    await con.getRepository(Archive).save([
      {
        ...archiveBase,
        scopeType: ArchiveScopeType.Tag,
        scopeId: 'rust',
        periodType: ArchivePeriodType.Month,
        periodStart: new Date('2025-01-01T00:00:00.000Z'),
        createdAt,
      },
      {
        ...archiveBase,
        scopeType: ArchiveScopeType.Tag,
        scopeId: 'rust',
        periodType: ArchivePeriodType.Month,
        periodStart: new Date('2025-02-01T00:00:00.000Z'),
        createdAt,
      },
      {
        ...archiveBase,
        scopeType: ArchiveScopeType.Source,
        scopeId: 'a',
        periodType: ArchivePeriodType.Month,
        periodStart: new Date('2025-01-01T00:00:00.000Z'),
        createdAt,
      },
      {
        ...archiveBase,
        scopeType: ArchiveScopeType.Global,
        scopeId: null,
        periodType: ArchivePeriodType.Month,
        periodStart: new Date('2025-01-01T00:00:00.000Z'),
        createdAt,
      },
    ]);

    const res = await request(app.server)
      .get('/sitemaps/archive-index.xml')
      .expect(200);

    expect(res.header['content-type']).toContain('application/xml');
    expect(res.header['cache-control']).toEqual(
      'public, max-age=7200, s-maxage=7200',
    );
    expect(res.text).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    );
    // Source 'a' has handle 'a'
    expect(res.text).toContain(
      '<loc>http://localhost:5002/sources/a/best-of</loc>',
    );
    // Tag rust should appear once (deduplicated)
    expect(res.text).toContain(
      '<loc>http://localhost:5002/tags/rust/best-of</loc>',
    );
    expect(res.text).toContain(
      '<loc>http://localhost:5002/posts/best-of</loc>',
    );
    // Only one entry for rust (two archives but one index)
    const rustMatches = res.text.match(/\/tags\/rust\/best-of<\/loc>/g);
    expect(rustMatches).toHaveLength(1);
    const globalMatches = res.text.match(/\/posts\/best-of<\/loc>/g);
    expect(globalMatches).toHaveLength(1);
  });

  it('should exclude source archives when the source has been deleted', async () => {
    await con.getRepository(Archive).save([
      {
        ...archiveBase,
        scopeType: ArchiveScopeType.Source,
        scopeId: 'nonexistent-source',
        periodType: ArchivePeriodType.Month,
        periodStart: new Date('2025-01-01T00:00:00.000Z'),
        createdAt: new Date(),
      },
    ]);

    const res = await request(app.server)
      .get('/sitemaps/archive-index.xml')
      .expect(200);

    expect(res.text).not.toContain('/sources/nonexistent-source/best-of');
  });

  it('should exclude squad sources from archive index', async () => {
    await con.getRepository(Archive).save([
      {
        ...archiveBase,
        scopeType: ArchiveScopeType.Source,
        scopeId: 'm',
        periodType: ArchivePeriodType.Month,
        periodStart: new Date('2025-01-01T00:00:00.000Z'),
        createdAt: new Date(),
      },
    ]);

    const res = await request(app.server)
      .get('/sitemaps/archive-index.xml')
      .expect(200);

    expect(res.text).not.toContain('/sources/moderatedSquad/best-of');
  });
});

describe('GET /sitemaps/archive-pages-:scopeType-:periodType-:page.xml', () => {
  const archiveBase = {
    subjectType: ArchiveSubjectType.Post,
    rankingType: ArchiveRankingType.Best,
  };

  it('should return tag monthly archive pages with correct URL format', async () => {
    const createdAt = new Date('2025-04-01T10:00:00.000Z');

    await con.getRepository(Archive).save([
      {
        ...archiveBase,
        scopeType: ArchiveScopeType.Tag,
        scopeId: 'golang',
        periodType: ArchivePeriodType.Month,
        periodStart: new Date('2025-01-01T00:00:00.000Z'),
        createdAt,
      },
      {
        ...archiveBase,
        scopeType: ArchiveScopeType.Tag,
        scopeId: 'golang',
        periodType: ArchivePeriodType.Year,
        periodStart: new Date('2024-01-01T00:00:00.000Z'),
        createdAt,
      },
    ]);

    const res = await request(app.server)
      .get('/sitemaps/archive-pages-tag-month-0.xml')
      .expect(200);

    expect(res.header['content-type']).toContain('application/xml');
    expect(res.header['cache-control']).toEqual(
      'public, max-age=7200, s-maxage=7200',
    );
    expect(res.text).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    );
    // Monthly tag archive with zero-padded month
    expect(res.text).toContain(
      '<loc>http://localhost:5002/tags/golang/best-of/2025/01</loc>',
    );
    // Should not include yearly archives
    expect(res.text).not.toContain(
      '<loc>http://localhost:5002/tags/golang/best-of/2024</loc>',
    );
    // Lastmod should be present
    expect(res.text).toContain('<lastmod>');
  });

  it('should return tag yearly archive pages', async () => {
    const createdAt = new Date('2025-04-01T10:00:00.000Z');

    await con.getRepository(Archive).save([
      {
        ...archiveBase,
        scopeType: ArchiveScopeType.Tag,
        scopeId: 'golang',
        periodType: ArchivePeriodType.Year,
        periodStart: new Date('2024-01-01T00:00:00.000Z'),
        createdAt,
      },
    ]);

    const res = await request(app.server)
      .get('/sitemaps/archive-pages-tag-year-0.xml')
      .expect(200);

    expect(res.text).toContain(
      '<loc>http://localhost:5002/tags/golang/best-of/2024</loc>',
    );
  });

  it('should return source monthly archive pages using handle', async () => {
    const createdAt = new Date('2025-04-01T10:00:00.000Z');

    await con.getRepository(Archive).save([
      {
        ...archiveBase,
        scopeType: ArchiveScopeType.Source,
        scopeId: 'b',
        periodType: ArchivePeriodType.Month,
        periodStart: new Date('2025-09-01T00:00:00.000Z'),
        createdAt,
      },
    ]);

    const res = await request(app.server)
      .get('/sitemaps/archive-pages-source-month-0.xml')
      .expect(200);

    // Source archive uses handle (source 'b' has handle 'b')
    expect(res.text).toContain(
      '<loc>http://localhost:5002/sources/b/best-of/2025/09</loc>',
    );
  });

  it('should return global monthly archive pages', async () => {
    const createdAt = new Date('2025-04-01T10:00:00.000Z');

    await con.getRepository(Archive).save([
      {
        ...archiveBase,
        scopeType: ArchiveScopeType.Global,
        scopeId: null,
        periodType: ArchivePeriodType.Month,
        periodStart: new Date('2025-03-01T00:00:00.000Z'),
        createdAt,
      },
    ]);

    const res = await request(app.server)
      .get('/sitemaps/archive-pages-global-month-0.xml')
      .expect(200);

    expect(res.text).toContain(
      '<loc>http://localhost:5002/posts/best-of/2025/03</loc>',
    );
  });

  it('should return global yearly archive pages', async () => {
    const createdAt = new Date('2025-04-01T10:00:00.000Z');

    await con.getRepository(Archive).save([
      {
        ...archiveBase,
        scopeType: ArchiveScopeType.Global,
        scopeId: null,
        periodType: ArchivePeriodType.Year,
        periodStart: new Date('2024-01-01T00:00:00.000Z'),
        createdAt,
      },
    ]);

    const res = await request(app.server)
      .get('/sitemaps/archive-pages-global-year-0.xml')
      .expect(200);

    expect(res.text).toContain(
      '<loc>http://localhost:5002/posts/best-of/2024</loc>',
    );
  });

  it('should return 404 for invalid scopeType', async () => {
    await request(app.server)
      .get('/sitemaps/archive-pages-invalid-month-0.xml')
      .expect(404);
  });

  it('should return 404 for invalid periodType', async () => {
    await request(app.server)
      .get('/sitemaps/archive-pages-tag-invalid-0.xml')
      .expect(404);
  });

  it('should return 404 for negative page', async () => {
    await request(app.server)
      .get('/sitemaps/archive-pages-tag-month--1.xml')
      .expect(404);
  });

  it('should return 404 for non-integer page', async () => {
    await request(app.server)
      .get('/sitemaps/archive-pages-tag-month-abc.xml')
      .expect(404);
  });

  it('should return empty urlset for page beyond data', async () => {
    const res = await request(app.server)
      .get('/sitemaps/archive-pages-tag-month-999.xml')
      .expect(200);

    expect(res.text).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    );
    expect(res.text).not.toContain('<loc>');
  });

  it('should exclude source archives when the source has been deleted', async () => {
    await con.getRepository(Archive).save([
      {
        ...archiveBase,
        scopeType: ArchiveScopeType.Source,
        scopeId: 'nonexistent-source',
        periodType: ArchivePeriodType.Month,
        periodStart: new Date('2025-01-01T00:00:00.000Z'),
        createdAt: new Date(),
      },
    ]);

    const res = await request(app.server)
      .get('/sitemaps/archive-pages-source-month-0.xml')
      .expect(200);

    expect(res.text).not.toContain('/sources/nonexistent-source/best-of');
  });

  it('should exclude squad sources from archive pages', async () => {
    await con.getRepository(Archive).save([
      {
        ...archiveBase,
        scopeType: ArchiveScopeType.Source,
        scopeId: 'm',
        periodType: ArchivePeriodType.Month,
        periodStart: new Date('2025-01-01T00:00:00.000Z'),
        createdAt: new Date(),
      },
    ]);

    const res = await request(app.server)
      .get('/sitemaps/archive-pages-source-month-0.xml')
      .expect(200);

    expect(res.text).not.toContain('/sources/moderatedSquad/best-of');
  });
});

describe('GET /sitemaps/index.xml (archive entries)', () => {
  const archiveBase = {
    subjectType: ArchiveSubjectType.Post,
    rankingType: ArchiveRankingType.Best,
  };

  it('should include archive-index and paginated archive-pages sitemaps', async () => {
    await con.getRepository(Archive).save([
      {
        ...archiveBase,
        scopeType: ArchiveScopeType.Global,
        scopeId: null,
        periodType: ArchivePeriodType.Month,
        periodStart: new Date('2025-02-01T00:00:00.000Z'),
        createdAt: new Date(),
      },
      {
        ...archiveBase,
        scopeType: ArchiveScopeType.Tag,
        scopeId: 'golang',
        periodType: ArchivePeriodType.Month,
        periodStart: new Date('2025-01-01T00:00:00.000Z'),
        createdAt: new Date(),
      },
      {
        ...archiveBase,
        scopeType: ArchiveScopeType.Source,
        scopeId: 'a',
        periodType: ArchivePeriodType.Year,
        periodStart: new Date('2024-01-01T00:00:00.000Z'),
        createdAt: new Date(),
      },
    ]);

    const res = await request(app.server)
      .get('/sitemaps/index.xml')
      .expect(200);

    expect(res.text).toContain(
      '<loc>http://localhost:5002/api/sitemaps/archive-index.xml</loc>',
    );
    expect(res.text).toContain(
      '<loc>http://localhost:5002/api/sitemaps/archive-pages-global-month-0.xml</loc>',
    );
    expect(res.text).toContain(
      '<loc>http://localhost:5002/api/sitemaps/archive-pages-tag-month-0.xml</loc>',
    );
    expect(res.text).toContain(
      '<loc>http://localhost:5002/api/sitemaps/archive-pages-source-year-0.xml</loc>',
    );
    // Should not contain old non-paginated archive-pages.xml
    expect(res.text).not.toContain(
      '<loc>http://localhost:5002/api/sitemaps/archive-pages.xml</loc>',
    );
  });

  it('should not include archive-pages entries when no archives exist', async () => {
    const res = await request(app.server)
      .get('/sitemaps/index.xml')
      .expect(200);

    expect(res.text).toContain(
      '<loc>http://localhost:5002/api/sitemaps/archive-index.xml</loc>',
    );
    expect(res.text).not.toContain('archive-pages-');
  });
});

describe('getSitemapRowLastmod', () => {
  it('should normalize pg timestamp format to ISO-8601', () => {
    const normalizedLastmod = getSitemapRowLastmod({
      lastmod: '2024-01-01 12:00:00.123456',
    });

    expect(normalizedLastmod).toEqual('2024-01-01T12:00:00.123Z');
  });

  it('should return ISO format for Date lastmod values', () => {
    const normalizedLastmod = getSitemapRowLastmod({
      lastmod: new Date('2024-01-01T12:00:00.123Z'),
    });

    expect(normalizedLastmod).toEqual('2024-01-01T12:00:00.123Z');
  });
});
