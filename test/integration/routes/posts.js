import { expect } from 'chai';
import supertest from 'supertest';
import { createTables, dropTables } from '../../../src/db';
import publication from '../../../src/models/publication';
import post from '../../../src/models/post';
import fixturePubs from '../../fixtures/publications';
import fixture from '../../fixtures/posts';
import config from '../../../src/config';
import app from '../../../src';

describe('posts routes', () => {
  let request;
  let server;

  beforeEach(async () => {
    await dropTables();
    await createTables();
    return Promise.all(fixturePubs.map(pub => publication.add(pub.name, pub.image, pub.enabled)));
  });

  before(() => {
    server = app.listen();
    request = supertest(server);
  });

  after(() => {
    server.close();
  });

  const mapDate = p => Object.assign({}, p, {
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
  });

  it('should fetch latest posts', async () => {
    await Promise.all(fixture.input.map(p =>
      post.add(
        p.id, p.title, p.url, p.publicationId, p.publishedAt, p.createdAt,
        p.image, p.ratio, p.placeholder,
      )));

    const result = await request
      .get('/v1/posts/latest')
      .query({ latest: fixture.input[1].createdAt.toISOString(), page: 0, pageSize: 20 })
      .expect(200);

    expect(result.body).to.deep.equal(fixture.output.map(mapDate));
  });

  it('should fetch latest posts by given publications', async () => {
    await Promise.all(fixture.input.map(p =>
      post.add(
        p.id, p.title, p.url, p.publicationId, p.publishedAt, p.createdAt,
        p.image, p.ratio, p.placeholder,
      )));

    const result = await request
      .get('/v1/posts/latest')
      .query({
        latest: fixture.input[1].createdAt.toISOString(),
        page: 0,
        pageSize: 20,
        pubs: [fixture.input[1].publicationId].join(','),
      })
      .expect(200);

    expect(result.body).to.deep.equal([fixture.output[0]].map(mapDate));
  });

  describe('get by id endpoint', () => {
    it('should fetch post', async () => {
      await Promise.all(fixture.input.map(p =>
        post.add(
          p.id, p.title, p.url, p.publicationId, p.publishedAt, p.createdAt,
          p.image, p.ratio, p.placeholder,
        )));

      const result = await request
        .get(`/v1/posts/${fixture.output[0].id}`)
        .expect(200);

      expect(result.body).to.deep.equal(mapDate(fixture.output[0]));
    });

    it('should return not found when post doesn\'t exist', async () => {
      const result = await request
        .get('/v1/posts/1234')
        .expect(404);

      expect(result.body.code).to.equal(2);
    });
  });

  describe('add endpoint', () => {
    it('should throw forbidden ', async () => {
      await request
        .post('/v1/posts')
        .expect(403);
    });

    it('should add new post', async () => {
      const body = mapDate(fixture.input[0]);
      const result = await request
        .post('/v1/posts')
        .send(body)
        .set('Authorization', config.admin)
        .expect(200);

      expect(result.body).to.deep.equal(body);
    });

    it('should add new post without image', async () => {
      const body = mapDate(fixture.input[1]);
      const result = await request
        .post('/v1/posts')
        .send(body)
        .set('Authorization', config.admin)
        .expect(200);

      expect(result.body).to.deep.equal(body);
    });

    it('should send bad request when publication doesn\'t exist', async () => {
      const body = Object.assign({}, mapDate(fixture.input[0]), { publicationId: '348901' });
      const result = await request
        .post('/v1/posts')
        .send(body)
        .set('Authorization', config.admin)
        .expect(400);

      expect(result.body.code).to.equal(1);
      expect(result.body.message).to.contain('"publicationId" fails');
    });

    it('should send conflict when id already exist', async () => {
      await Promise.all(fixture.input.map(p =>
        post.add(
          p.id, p.title, p.url, p.publicationId, p.publishedAt, p.createdAt,
          p.image, p.ratio, p.placeholder,
        )));

      const body = mapDate(fixture.input[0]);
      const result = await request
        .post('/v1/posts')
        .send(body)
        .set('Authorization', config.admin)
        .expect(409);

      expect(result.body.code).to.equal(4);
    });
  });
});
