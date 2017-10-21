import { expect } from 'chai';
import supertest from 'supertest';
import { createTables, dropTables } from '../../../src/db';
import publication from '../../../src/models/publication';
import source from '../../../src/models/source';
import fixturePubs from '../../fixtures/publications';
import fixture from '../../fixtures/sources';
import app from '../../../src';

describe('sources routes', async () => {
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

  it('should fetch all sources', async () => {
    await Promise.all(fixturePubs.map(pub => publication.add(pub.name, pub.name)));
    await Promise.all(fixture.map(s => source.add(s.publicationId, s.url)));

    const result = await request
      .get('/v1/sources')
      .expect(200);

    expect(result.body).to.deep.equal(fixture);
  });
});
