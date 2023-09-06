import appFunc from '../src';
import { FastifyInstance } from 'fastify';
import { saveFixtures } from './helpers';
import { Keyword, Post, Source } from '../src/entity';
import { sourcesFixture } from './fixture/source';
import request from 'supertest';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { postsFixture } from './fixture/post';
import { keywordsFixture } from './fixture/keywords';

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
  await saveFixtures(con, Keyword, keywordsFixture);
  await saveFixtures(con, Post, postsFixture);
});

describe('GET /p/snotra/all_tags', () => {
  it('should return not found when not authorized', () => {
    return request(app.server).get('/p/snotra/all_tags').expect(400);
  });

  it('should return all tags', async () => {
    const { body } = await request(app.server)
      .get('/p/snotra/all_tags')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send()
      .expect(200);

    expect(body).toEqual([
      { name: 'development' },
      { name: 'fullstack' },
      { name: 'golang' },
      { name: 'rust' },
      { name: 'webdev' },
    ]);
  });
});

describe('GET /p/snotra/all_sources', () => {
  it('should return not found when not authorized', () => {
    return request(app.server).get('/p/snotra/all_sources').expect(400);
  });

  it('should return all sources', async () => {
    const { body } = await request(app.server)
      .get('/p/snotra/all_sources')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send()
      .expect(200);

    expect(body).toEqual([
      { name: 'a' },
      { name: 'b' },
      { name: 'c' },
      { name: 'community' },
    ]);
  });
});

describe('GET /p/snotra/all_content_curations', () => {
  it('should return not found when not authorized', () => {
    return request(app.server)
      .get('/p/snotra/all_content_curations')
      .expect(400);
  });

  it('should return all content curations', async () => {
    const { body } = await request(app.server)
      .get('/p/snotra/all_content_curations')
      .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
      .send()
      .expect(200);

    expect(body).toEqual([{ name: 'c1' }, { name: 'c2' }]);
  });
});
