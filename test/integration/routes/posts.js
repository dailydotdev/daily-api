import { expect } from 'chai';
import supertest from 'supertest';
import { migrate, rollback } from '../../../src/db';
import publication from '../../../src/models/publication';
import post from '../../../src/models/post';
import fixturePubs from '../../fixtures/publications';
import fixture from '../../fixtures/posts';
import app from '../../../src';

describe('posts routes', () => {
  let request;
  let server;

  beforeEach(async () => {
    await rollback();
    await migrate();
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
        p.image, p.ratio, p.placeholder, p.promoted,
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
        p.image, p.ratio, p.placeholder, p.promoted,
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

  it('should fetch promoted posts', async () => {
    await Promise.all(fixture.input.map(p =>
      post.add(
        p.id, p.title, p.url, p.publicationId, p.publishedAt, p.createdAt,
        p.image, p.ratio, p.placeholder, p.promoted,
      )));

    const result = await request
      .get('/v1/posts/promoted')
      .expect(200);

    expect(result.body).to.deep.equal(fixture.promotedOutput.map(mapDate));
  });

  describe('get by id endpoint', () => {
    it('should fetch post', async () => {
      await Promise.all(fixture.input.map(p =>
        post.add(
          p.id, p.title, p.url, p.publicationId, p.publishedAt, p.createdAt,
          p.image, p.ratio, p.placeholder, p.promoted,
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
});
