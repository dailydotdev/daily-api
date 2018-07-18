import { expect } from 'chai';
import supertest from 'supertest';
import knexCleaner from 'knex-cleaner';
import db, { migrate } from '../../../src/db';
import publication from '../../../src/models/publication';
import fixture from '../../fixtures/publications';
import app from '../../../src';

describe('publications routes', () => {
  let request;
  let server;

  beforeEach(async () => {
    await knexCleaner.clean(db, { ignoreTables: ['knex_migrations', 'knex_migrations_lock'] });
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
