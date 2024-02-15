import { FastifyInstance } from 'fastify';
import appFunc from '../src';
import request from 'supertest';
import nock from 'nock';
import { saveFixtures } from './helpers';
import { DataSource, DeepPartial } from 'typeorm';
import createOrGetConnection from '../src/db';
import { Post, PostType, Source, User } from '../src/entity';
import { sourcesFixture } from './fixture/source';
import { BASE_ROBOTS } from '../src/routes/sitemaps';
import { BotUser } from '../src/entity/user/BotUser';

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

const usersFixture: DeepPartial<User>[] = [
  {
    id: '1',
    createdAt: now,
    username: 'a',
  },
  {
    id: '2',
    createdAt: now,
    username: 'b',
    reputation: 100,
  },
  {
    id: '3',
    createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60),
    username: 'c',
    reputation: 100,
  },
  {
    id: '4',
    createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60),
    username: 'd',
  },
];

const botsFixture: DeepPartial<BotUser>[] = [
  {
    id: 'b1',
    createdAt: now,
    username: 'ba',
  },
  {
    id: 'b2',
    createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60),
    username: 'bb',
  },
];

beforeAll(async () => {
  con = await createOrGetConnection();
  app = await appFunc();
  return app.ready();
});

beforeEach(async () => {
  nock.cleanAll();
  await saveFixtures(con, Source, sourcesFixture);
  await con.getRepository(Post).insert(postsFixture);
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, BotUser, botsFixture);
});

afterAll(() => app.close());

describe('GET /sitemaps/posts.txt', () => {
  it('should return posts ordered by time', async () => {
    const res = await request(app.server)
      .get('/sitemaps/posts.txt')
      .expect(200);
    expect(res.header['content-type']).toEqual('text/plain');
    expect(res.header['cache-control']).toBeTruthy();
    expect(res.text).toEqual(`http://localhost:5002/posts/p1
http://localhost:5002/posts/p4
http://localhost:5002/posts/p5
`);
  });
});

describe('GET /sitemaps/robots.txt', () => {
  it('should return bots, fresh users and base file', async () => {
    const res = await request(app.server)
      .get('/sitemaps/robots.txt')
      .expect(200);
    expect(res.header['content-type']).toEqual('text/plain');
    expect(res.header['cache-control']).toBeTruthy();
    expect(res.text).toEqual(`${BASE_ROBOTS}Disallow: /d
Disallow: /a
Disallow: /bb
Disallow: /ba
Disallow: /ghost
`);
  });
});
