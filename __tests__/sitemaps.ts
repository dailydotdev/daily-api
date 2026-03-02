import { FastifyInstance } from 'fastify';
import appFunc from '../src';
import request from 'supertest';
import nock from 'nock';
import { saveFixtures } from './helpers';
import { DataSource, DeepPartial } from 'typeorm';
import createOrGetConnection from '../src/db';
import { Keyword, KeywordStatus, Post, PostType, Source } from '../src/entity';
import { sourcesFixture } from './fixture/source';
import { keywordsFixture } from './fixture/keywords';
let app: FastifyInstance;
let con: DataSource;

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

beforeAll(async () => {
  con = await createOrGetConnection();
  app = await appFunc();
  return app.ready();
});

beforeEach(async () => {
  nock.cleanAll();
  await saveFixtures(con, Keyword, keywordsFixture);
  await saveFixtures(con, Source, sourcesFixture);
  await con.getRepository(Post).insert(postsFixture);
});

afterAll(() => app.close());

describe('GET /sitemaps/posts.txt', () => {
  it('should return posts ordered by time', async () => {
    const res = await request(app.server)
      .get('/sitemaps/posts.txt')
      .expect(200);
    expect(res.header['content-type']).toEqual('text/plain');
    expect(res.header['cache-control']).toBeTruthy();
    expect(res.text).toEqual(`http://localhost:5002/posts/p1-p1
http://localhost:5002/posts/p4-p4
http://localhost:5002/posts/p5-p5
`);
  });
});

describe('GET /sitemaps/posts.xml', () => {
  it('should return posts sitemap as xml', async () => {
    const res = await request(app.server)
      .get('/sitemaps/posts.xml')
      .expect(200);

    expect(res.header['content-type']).toContain('application/xml');
    expect(res.header['cache-control']).toBeTruthy();
    expect(res.text).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    );
    expect(res.text).toContain('<loc>http://localhost:5002/posts/p1-p1</loc>');
    expect(res.text).toContain('<loc>http://localhost:5002/posts/p4-p4</loc>');
    expect(res.text).toContain('<loc>http://localhost:5002/posts/p5-p5</loc>');
    expect(res.text).not.toContain('/posts/p2-p2');
    expect(res.text).not.toContain('/posts/p3-p3');
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
  });
});

describe('GET /sitemaps/index.xml', () => {
  it('should return sitemap index xml', async () => {
    const res = await request(app.server)
      .get('/sitemaps/index.xml')
      .expect(200);

    expect(res.header['content-type']).toContain('application/xml');
    expect(res.header['cache-control']).toBeTruthy();
    expect(res.text).toContain(
      '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    );
    expect(res.text).toContain(
      '<loc>http://localhost:5002/api/sitemaps/posts.xml</loc>',
    );
    expect(res.text).toContain(
      '<loc>http://localhost:5002/api/sitemaps/tags.xml</loc>',
    );
  });
});
