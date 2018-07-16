import { expect } from 'chai';
import supertest from 'supertest';
import { migrate, rollback } from '../../../src/db';
import publication from '../../../src/models/publication';
import fixture from '../../fixtures/publications';
import app from '../../../src';

describe('publications routes', () => {
  let request;
  let server;

  beforeEach(async () => {
    await rollback();
    await migrate();
    return Promise.all(fixture.map(pub =>
      publication.add(pub.name, pub.image, pub.enabled, pub.twitter)));
  });

  before(() => {
    server = app.listen();
    request = supertest(server);
  });

  after(() => {
    server.close();
  });

  it('should fetch enabled publications', async () => {
    const result = await request
      .get('/v1/publications')
      .expect(200);

    expect(result.body).to.deep.equal([fixture[0], fixture[1]]);
  });
});
