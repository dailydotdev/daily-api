import { Connection, getConnection, DeepPartial, In } from 'typeorm';
import nock from 'nock';
import { FastifyInstance } from 'fastify';
import request from 'supertest';
import appFunc from '../src';
import {
  Bookmark,
  BookmarkList,
  Feed,
  FeedTag,
  FeedSource,
  Post,
  PostTag,
  Source, SourceDisplay,
} from '../src/entity';
import { saveFixtures } from './helpers';
import { sourcesFixture } from './fixture/source';
import { postTagsFixture } from './fixture/post';
import { sourceDisplaysFixture } from './fixture/sourceDisplay';

let app: FastifyInstance;
let con: Connection;

const now = new Date(1591192264260);
export const postsFixture: DeepPartial<Post>[] = [
  {
    id: 'p1',
    title: 'P1',
    url: 'http://p1.com',
    score: 0,
    sourceId: 'a',
    createdAt: now,
  },
  {
    id: 'p2',
    title: 'P2',
    url: 'http://p2.com',
    score: 7,
    sourceId: 'b',
    createdAt: new Date(now.getTime() - 1000),
  },
  {
    id: 'p3',
    title: 'P3',
    url: 'http://p3.com',
    score: 4,
    sourceId: 'c',
    createdAt: new Date(now.getTime() - 2000),
  },
  {
    id: 'p4',
    title: 'P4',
    url: 'http://p4.com',
    score: 3,
    sourceId: 'a',
    createdAt: new Date(now.getTime() - 3000),
  },
  {
    id: 'p5',
    title: 'P5',
    url: 'http://p5.com',
    score: 10,
    sourceId: 'b',
    createdAt: new Date(now.getTime() - 4000),
  },
];

const bookmarksFixture = [
  {
    userId: '1',
    postId: 'p3',
    createdAt: new Date(now.getTime() - 1000),
  },
  {
    userId: '1',
    postId: 'p1',
    createdAt: new Date(now.getTime() - 2000),
  },
  {
    userId: '1',
    postId: 'p5',
    createdAt: new Date(now.getTime() - 3000),
  },
];

const saveFeedFixtures = async (): Promise<void> => {
  await saveFixtures(con, Feed, [{ id: '1', userId: '1' }]);
  await saveFixtures(con, FeedTag, [
    { feedId: '1', tag: 'html' },
    { feedId: '1', tag: 'javascript' },
  ]);
  await saveFixtures(con, FeedSource, [
    { feedId: '1', sourceId: 'b' },
    { feedId: '1', sourceId: 'c' },
  ]);
};

beforeAll(async () => {
  con = await getConnection();
  app = await appFunc();
  return app.ready();
});

afterAll(() => app.close());

beforeEach(async () => {
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, SourceDisplay, sourceDisplaysFixture);
  await saveFixtures(con, Post, postsFixture);
  await saveFixtures(con, PostTag, postTagsFixture);
  await saveFixtures(con, Bookmark, bookmarksFixture);
});

const mockUser = (premium = true): nock.Scope =>
  nock(process.env.GATEWAY_URL)
    .get('/v1/users/me')
    .matchHeader('authorization', `Service ${process.env.GATEWAY_SECRET}`)
    .matchHeader('user-id', '1')
    .matchHeader('logged-in', 'true')
    .reply(200, { id: '1', email: 'ido@daily.dev', name: 'Ido', premium });

const mockFailedUser = (): nock.Scope =>
  nock(process.env.GATEWAY_URL)
    .get('/v1/users/me')
    .matchHeader('authorization', `Service ${process.env.GATEWAY_SECRET}`)
    .matchHeader('user-id', '1')
    .matchHeader('logged-in', 'true')
    .reply(401);

describe('GET /rss/b/:userId', () => {
  const path = '/rss/b/1';

  it('should fail when user does not exist', () => {
    mockFailedUser();
    return request(app.server).get(path).expect(403);
  });

  it('should fail when user is not premium', () => {
    mockUser(false);
    return request(app.server).get(path).expect(403);
  });

  it('should return rss feed of bookmarks', async () => {
    mockUser();
    const res = await request(app.server)
      .get(path)
      .expect('Content-Type', 'application/rss+xml')
      .expect(200);
    expect(
      res.text.replace(/\<lastBuildDate>.*?<\/lastBuildDate>/g, ''),
    ).toMatchSnapshot();
  });
});

describe('GET /rss/b/l/:listId', () => {
  const path = (id: string): string => `/rss/b/l/${id}`;

  let list: BookmarkList;

  beforeEach(async () => {
    list = await con
      .getRepository(BookmarkList)
      .save({ name: 'Gems', userId: '1' });
  });

  it('should fail when user does not exist', () => {
    mockFailedUser();
    return request(app.server).get(path(list.id)).expect(403);
  });

  it('should fail when user is not premium', () => {
    mockUser(false);
    return request(app.server).get(path(list.id)).expect(403);
  });

  it('should fail when list does not exist', () => {
    mockUser();
    return request(app.server).get(path('list')).expect(403);
  });

  it('should return rss feed of bookmarks', async () => {
    mockUser();
    await con
      .getRepository(Bookmark)
      .update({ postId: In(['p1', 'p3']) }, { listId: list.id });
    const res = await request(app.server)
      .get(path(list.id))
      .expect('Content-Type', 'application/rss+xml')
      .expect(200);
    expect(
      res.text
        .replace(/\<lastBuildDate>.*?<\/lastBuildDate>/g, '')
        .replace(/\<atom:link.*?type=\"application\/rss\+xml\"\/>/g, ''),
    ).toMatchSnapshot();
  });
});

describe('GET /rss/f/:userId', () => {
  const path = '/rss/f/1';

  it('should fail when user does not exist', () => {
    mockFailedUser();
    return request(app.server).get(path).expect(403);
  });

  it('should fail when user is not premium', () => {
    mockUser(false);
    return request(app.server).get(path).expect(403);
  });

  it('should fail when feed does not exist', () => {
    mockUser();
    return request(app.server).get(path).expect(403);
  });

  it('should return rss feed of bookmarks', async () => {
    mockUser();
    await saveFeedFixtures();
    const res = await request(app.server)
      .get(path)
      .expect('Content-Type', 'application/rss+xml')
      .expect(200);
    expect(
      res.text.replace(/\<lastBuildDate>.*?<\/lastBuildDate>/g, ''),
    ).toMatchSnapshot();
  });
});
