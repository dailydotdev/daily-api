import appFunc from '../src';
import { FastifyInstance } from 'fastify';
import { saveFixtures, TEST_UA } from './helpers';
import { ArticlePost, Source, User, YouTubePost } from '../src/entity';
import { sourcesFixture } from './fixture/source';
import request from 'supertest';
import { postsFixture, videoPostsFixture } from './fixture/post';
import { notifyView } from '../src/common';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { fallbackImages } from '../src/config';

jest.mock('../src/common', () => ({
  ...(jest.requireActual('../src/common') as Record<string, unknown>),
  notifyView: jest.fn(),
}));

let app: FastifyInstance;
let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
  app = await appFunc();
  return app.ready();
});

afterAll(() => app.close());

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
  await saveFixtures(con, YouTubePost, videoPostsFixture);
});

describe('GET /r/:postId', () => {
  it('should return not found', () => {
    return request(app.server).get('/r/not').expect(404);
  });

  it('should redirect to post url', () => {
    return request(app.server)
      .get('/r/p1')
      .expect(302)
      .expect('Location', 'http://p1.com/?ref=dailydev');
  });

  it('should redirect to youtube post url', () => {
    return request(app.server)
      .get('/r/yt1')
      .expect(302)
      .expect('Location', 'https://youtu.be/T_AbQGe7fuU?ref=dailydev');
  });

  it('should render redirect html and notify view event', async () => {
    await request(app.server)
      .get('/r/p1')
      .set('user-agent', TEST_UA)
      .set('cookie', 'da2=u1')
      .set('referer', 'https://daily.dev')
      .expect(200)
      .expect('content-type', 'text/html')
      .expect('referrer-policy', 'origin, origin-when-cross-origin')
      .expect(
        'link',
        `<http://p1.com/?ref=dailydev>; rel=dns-prefetch, <http://p1.com/?ref=dailydev>; rel=preconnect; crossorigin`,
      )
      .expect(
        '<html><head><meta name="robots" content="noindex,nofollow"><meta http-equiv="refresh" content="0;URL=http://p1.com/?ref=dailydev"><style>:root{color-scheme:light dark}@media (prefers-color-scheme: dark){html,body{background-color:#0f1217;}}@media (prefers-color-scheme: light){html,body{background-color:#fff;}}html,body{margin:0;padding:0;min-height:100vh}</style></head></html>',
      );
    expect(notifyView).toBeCalledWith(
      expect.anything(),
      'p1',
      'u1',
      'https://daily.dev',
      expect.anything(),
      ['javascript', 'webdev'],
    );
  });

  it('should render redirect html with hash value', async () => {
    await request(app.server)
      .get('/r/p1?a=id')
      .set('user-agent', TEST_UA)
      .expect(200)
      .expect('content-type', 'text/html')
      .expect('referrer-policy', 'origin, origin-when-cross-origin')
      .expect(
        'link',
        `<http://p1.com/?ref=dailydev#id>; rel=dns-prefetch, <http://p1.com/?ref=dailydev#id>; rel=preconnect; crossorigin`,
      )
      .expect(
        '<html><head><meta name="robots" content="noindex,nofollow"><meta http-equiv="refresh" content="0;URL=http://p1.com/?ref=dailydev#id"><style>:root{color-scheme:light dark}@media (prefers-color-scheme: dark){html,body{background-color:#0f1217;}}@media (prefers-color-scheme: light){html,body{background-color:#fff;}}html,body{margin:0;padding:0;min-height:100vh}</style></head></html>',
      );
  });

  it('should concat query params correctly', async () => {
    await con
      .getRepository(ArticlePost)
      .update({ id: 'p1' }, { url: 'http://p1.com/?a=b' });
    return request(app.server)
      .get('/r/p1')
      .expect(302)
      .expect('Location', 'http://p1.com/?a=b&ref=dailydev');
  });

  it('should redirect to post page when url is not available', async () => {
    await con.getRepository(ArticlePost).update({ id: 'p1' }, { url: null });
    return request(app.server)
      .get('/r/p1')
      .expect(302)
      .expect('Location', 'http://localhost:5002/posts/p1-p1');
  });
});

describe('GET /:id/profile-image', () => {
  beforeEach(async () => {
    await con.getRepository(User).save([
      {
        id: '1',
        name: 'Ido',
        image: 'https://daily.dev/ido.jpg',
        timezone: 'utc',
        createdAt: new Date(),
      },
    ]);
  });

  it('should return profile picture for user', async () => {
    return request(app.server)
      .get('/1/profile-image')
      .expect(302)
      .expect('Location', 'https://daily.dev/ido.jpg');
  });

  it('should return default image for non existing user', async () => {
    return request(app.server)
      .get('/123/profile-image')
      .expect(302)
      .expect('Location', fallbackImages.avatar);
  });
});
