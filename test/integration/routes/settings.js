import { expect } from 'chai';
import supertest from 'supertest';
import knexCleaner from 'knex-cleaner';
import config from '../../../src/config';
import db, { migrate } from '../../../src/db';
import settings from '../../../src/models/settings';
import fixture from '../../fixtures/settings';
import app from '../../../src';

describe('settings routes', () => {
  let request;
  let server;

  beforeEach(async () => {
    await knexCleaner.clean(db, { ignoreTables: ['knex_migrations', 'knex_migrations_lock'] });
    await migrate();
  });

  before(() => {
    server = app.listen();
    request = supertest(server);
  });

  after(() => {
    server.close();
  });

  it('should throw forbidden on get without authorization', async () => {
    await request
      .get('/v1/settings')
      .expect(403);
  });

  it('should return the user settings', async () => {
    await settings.upsert(fixture.input[0]);

    const { body } = await request
      .get('/v1/settings')
      .set('Authorization', `Service ${config.accessSecret}`)
      .set('User-Id', fixture.input[0].userId)
      .set('Logged-In', true)
      .expect(200);

    expect(body).to.deep.equal(fixture.output[0]);
  });

  it('should throw forbidden on post without authorization', async () => {
    await request
      .post('/v1/settings')
      .expect(403);
  });

  it('should update the user settings', async () => {
    const { body } = await request
      .post('/v1/settings')
      .set('Authorization', `Service ${config.accessSecret}`)
      .set('User-Id', 'user3')
      .set('Logged-In', true)
      .send({ userId: 'user3', theme: 'bright' })
      .expect(200);

    expect(body).to.deep.equal({ userId: 'user3', theme: 'bright' });
  });
});
