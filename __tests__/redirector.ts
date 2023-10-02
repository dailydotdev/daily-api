import appFunc from '../src';
import { FastifyInstance } from 'fastify';
import { saveFixtures, TEST_UA } from './helpers';
import { ArticlePost, Source } from '../src/entity';
import { sourcesFixture } from './fixture/source';
import request from 'supertest';
import { postsFixture } from './fixture/post';
import { notifyView } from '../src/common';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';

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

  it('should render redirect html and notify view event', async () => {
    await request(app.server)
      .get('/r/p1')
      .set('user-agent', TEST_UA)
      .set('cookie', 'da2=u1')
      .set('referer', 'https://daily.dev')
      .expect(200)
      .expect('content-type', 'text/html')
      .expect('referrer-policy', 'origin, origin-when-cross-origin')
      .expect('link', `<http://p1.com/?ref=dailydev>; rel="preconnect"`)
      .expect(
        '<html><head><meta http-equiv="refresh" content="0;URL=http://p1.com/?ref=dailydev"></head></html>',
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
      .expect('link', `<http://p1.com/?ref=dailydev>; rel="preconnect"`)
      .expect(
        '<html><head><meta http-equiv="refresh" content="0;URL=http://p1.com/?ref=dailydev#id"></head></html>',
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
});
