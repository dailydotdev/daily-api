import { expect } from 'chai';
import supertest from 'supertest';
import { createTables, dropTables } from '../../../src/db';
import publication from '../../../src/models/publication';
import post from '../../../src/models/post';
import fixturePubs from '../../fixtures/publications';
import fixture from '../../fixtures/posts';
import app from '../../../src';

describe('posts routes', () => {
  let request;
  let server;

  beforeEach(async () => {
    await dropTables();
    await createTables();
    return Promise.all(fixturePubs.map(pub => publication.add(pub.name, pub.image)));
  });

  before(() => {
    server = app.listen();
    request = supertest(server);
  });

  after(() => {
    server.close();
  });

  const mapOutput = p => Object.assign({}, p, { publishedAt: p.publishedAt.toISOString() });

  it('should fetch latest posts', async () => {
    await Promise.all(fixture.input.map(p =>
      post.add(p.id, p.title, p.url, p.publicationId, p.publishedAt, p.image)));

    const result = await request
      .get('/v1/posts/latest')
      .query({ latest: fixture.input[1].publishedAt.toISOString(), page: 0, pageSize: 20 })
      .expect(200);

    expect(result.body).to.deep.equal(fixture.output.map(mapOutput));
  });

  describe('get post by id endpoint', () => {
    it('should fetch post', async () => {
      await Promise.all(fixture.input.map(p =>
        post.add(p.id, p.title, p.url, p.publicationId, p.publishedAt, p.image)));

      const result = await request
        .get(`/v1/posts/${fixture.output[0].id}`)
        .expect(200);

      expect(result.body).to.deep.equal(mapOutput(fixture.output[0]));
    });

    it('should return not found when post doesn\'t exist', async () => {
      await request
        .get('/v1/posts/1234')
        .expect(404);
    });
  });
});
