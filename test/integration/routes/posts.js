import { expect } from 'chai';
import supertest from 'supertest';
import { createTables, dropTables } from '../../../src/db';
import publication from '../../../src/models/publication';
import post from '../../../src/models/post';
import fixturePubs from '../../fixtures/publications';
import fixture from '../../fixtures/posts';
import app from '../../../src';

describe('posts routes', async () => {
  let request;
  let server;

  beforeEach(async () => {
    await dropTables();
    await createTables();
  });

  before(() => {
    server = app.listen();
    request = supertest(server);
  });

  after(() => {
    server.close();
  });

  it('should fetch latest posts', async () => {
    await Promise.all(fixturePubs.map(pub => publication.add(pub.name, pub.image)));
    await Promise.all(fixture.input.map(p =>
      post.add(p.id, p.title, p.url, p.publicationId, p.publishedAt, p.image)));

    const result = await request
      .get('/v1/posts/latest')
      .query({ latest: fixture.input[1].publishedAt.toISOString(), page: 0, pageSize: 20 })
      .expect(200);

    expect(result.body).to.deep.equal(fixture.output
      .map(p => Object.assign({}, p, { publishedAt: p.publishedAt.toISOString() })));
  });
});
