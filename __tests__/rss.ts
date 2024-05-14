import { DataSource, DeepPartial } from 'typeorm';
import { FastifyInstance } from 'fastify';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import appFunc from '../src';
import {
  Bookmark,
  Source,
  PostKeyword,
  Settings,
  User,
  ArticlePost,
} from '../src/entity';
import { saveFixtures } from './helpers';
import { sourcesFixture } from './fixture/source';
import { postKeywordsFixture } from './fixture/post';
import { usersFixture } from './fixture/user';
import createOrGetConnection from '../src/db';

let app: FastifyInstance;
let con: DataSource;

const now = new Date(1591192264260);
export const postsFixture: DeepPartial<ArticlePost>[] = [
  {
    id: 'p1',
    shortId: 'p1',
    title: 'P1',
    url: 'http://p1.com',
    score: 0,
    sourceId: 'a',
    createdAt: now,
  },
  {
    id: 'p2',
    shortId: 'p2',
    title: 'P2',
    url: 'http://p2.com',
    score: 7,
    sourceId: 'b',
    createdAt: new Date(now.getTime() - 1000),
  },
  {
    id: 'p3',
    shortId: 'p3',
    title: 'P3',
    url: 'http://p3.com',
    score: 4,
    sourceId: 'c',
    createdAt: new Date(now.getTime() - 2000),
  },
  {
    id: 'p4',
    shortId: 'p4',
    title: 'P4',
    url: 'http://p4.com',
    score: 3,
    sourceId: 'a',
    createdAt: new Date(now.getTime() - 3000),
  },
  {
    id: 'p5',
    shortId: 'p5',
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

// const saveFeedFixtures = async (): Promise<void> => {
//   await saveFixtures(con, Feed, [{ id: '1', userId: '1' }]);
//   await saveFixtures(con, FeedTag, [
//     { feedId: '1', tag: 'html' },
//     { feedId: '1', tag: 'javascript' },
//   ]);
//   await saveFixtures(con, FeedSource, [
//     { feedId: '1', sourceId: 'b' },
//     { feedId: '1', sourceId: 'c' },
//   ]);
// };

beforeAll(async () => {
  con = await createOrGetConnection();
  app = await appFunc();
  return app.ready();
});

afterAll(() => app.close());

beforeEach(async () => {
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
  await saveFixtures(con, PostKeyword, postKeywordsFixture);
  await saveFixtures(con, Bookmark, bookmarksFixture);
});

describe('GET /rss/b/:slug', () => {
  const slug = uuidv4();
  const path = `/rss/b/${slug}`;

  it('should fail when user does not exist', async () => {
    await con.getRepository(Settings).save({ userId: '1', bookmarkSlug: slug });
    await con.getRepository(User).delete({});
    return request(app.server).get(path).expect(404);
  });

  it('should fail when bookmarks are private', async () => {
    await con.getRepository(User).save([usersFixture[0]]);
    await con.getRepository(Settings).save({ userId: '1', bookmarkSlug: null });
    return request(app.server).get(path).expect(404);
  });

  it('should fail when slug is not a valid uuid', async () => {
    return request(app.server).get('/rss/b/1').expect(404);
  });

  it('should return rss feed of bookmarks', async () => {
    await con.getRepository(User).save([usersFixture[0]]);
    await con.getRepository(Settings).save({ userId: '1', bookmarkSlug: slug });
    const res = await request(app.server)
      .get(path)
      .expect('Content-Type', 'application/rss+xml')
      .expect(200);
    expect(
      res.text
        .replace(/\<lastBuildDate>.*?<\/lastBuildDate>/g, '')
        .replace(slug, 'uuid'),
    ).toMatchSnapshot();
  });
});
//
// describe('GET /rss/b/l/:listId', () => {
//   const path = (id: string): string => `/rss/b/l/${id}`;
//
//   let list: BookmarkList;
//
//   beforeEach(async () => {
//     list = await con
//       .getRepository(BookmarkList)
//       .save({ name: 'Gems', userId: '1' });
//   });
//
//   it('should fail when user does not exist', () => {
//     mockFailedUser();
//     return request(app.server).get(path(list.id)).expect(403);
//   });
//
//   it('should fail when user is not premium', () => {
//     mockUser(false);
//     return request(app.server).get(path(list.id)).expect(403);
//   });
//
//   it('should fail when list does not exist', () => {
//     mockUser();
//     return request(app.server).get(path('list')).expect(403);
//   });
//
//   it('should return rss feed of bookmarks', async () => {
//     mockUser();
//     await con
//       .getRepository(Bookmark)
//       .update({ postId: In(['p1', 'p3']) }, { listId: list.id });
//     const res = await request(app.server)
//       .get(path(list.id))
//       .expect('Content-Type', 'application/rss+xml')
//       .expect(200);
//     expect(
//       res.text
//         .replace(/\<lastBuildDate>.*?<\/lastBuildDate>/g, '')
//         .replace(/\<atom:link.*?type=\"application\/rss\+xml\"\/>/g, ''),
//     ).toMatchSnapshot();
//   });
// });
//
// describe('GET /rss/f/:userId', () => {
//   const path = '/rss/f/1';
//
//   it('should fail when user does not exist', () => {
//     mockFailedUser();
//     return request(app.server).get(path).expect(403);
//   });
//
//   it('should fail when user is not premium', () => {
//     mockUser(false);
//     return request(app.server).get(path).expect(403);
//   });
//
//   it('should fail when feed does not exist', () => {
//     mockUser();
//     return request(app.server).get(path).expect(403);
//   });
//
//   it('should return rss feed of bookmarks', async () => {
//     mockUser();
//     await saveFeedFixtures();
//     const res = await request(app.server)
//       .get(path)
//       .expect('Content-Type', 'application/rss+xml')
//       .expect(200);
//     expect(
//       res.text.replace(/\<lastBuildDate>.*?<\/lastBuildDate>/g, ''),
//     ).toMatchSnapshot();
//   });
// });
