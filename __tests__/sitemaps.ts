import { FastifyInstance } from 'fastify';
import appFunc from '../src';
import request from 'supertest';
import nock from 'nock';
import { saveFixtures } from './helpers';
import { DataSource, DeepPartial } from 'typeorm';
import createOrGetConnection from '../src/db';
import {
  AGENTS_DIGEST_SOURCE,
  Keyword,
  KeywordStatus,
  Post,
  PostType,
  SentimentEntity,
  SentimentGroup,
  Source,
  User,
} from '../src/entity';
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
      '<loc>http://localhost:5002/tags/web&amp;ai</loc>',
    );
    expect(res.text).not.toContain('/tags/web-development');
    expect(res.text).not.toContain('/tags/politics');
    expect(res.text).not.toContain('/tags/pending');
  });
});

describe('GET /sitemaps/index.xml', () => {
  it('should return sitemap index xml with all paginated post sitemaps', async () => {
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
      '<loc>http://localhost:5002/api/sitemaps/tags.xml</loc>',
    );
    expect(res.text).toContain(
      '<loc>http://localhost:5002/api/sitemaps/agents.xml</loc>',
    );
    expect(res.text).toContain(
      '<loc>http://localhost:5002/api/sitemaps/agents-digest.xml</loc>',
    );
    expect(res.text).toContain(
      '<loc>http://localhost:5002/api/sitemaps/squads.xml</loc>',
    );
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
