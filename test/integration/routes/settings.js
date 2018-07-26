import { expect } from 'chai';
import supertest from 'supertest';
import knexCleaner from 'knex-cleaner';
import db, { migrate } from '../../../src/db';
import settings from '../../../src/models/settings';
import fixture from '../../fixtures/settings';
import app from '../../../src';
import { sign } from '../../../src/jwt';

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
    const accessToken = await sign({ userId: fixture.input[0].userId });

    const { body } = await request
      .get('/v1/settings')
      .set('Authorization', `Bearer ${accessToken.token}`)
      .expect(200);

    expect(body).to.deep.equal(fixture.output[0]);
  });

  it('should throw forbidden on post without authorization', async () => {
    await request
      .post('/v1/settings')
      .expect(403);
  });

  it('should update the user settings', async () => {
    const accessToken = await sign({ userId: 'user3' });

    const { body } = await request
      .post('/v1/settings')
      .set('Authorization', `Bearer ${accessToken.token}`)
      .send({ userId: 'user3', theme: 'bright' })
      .expect(200);

    expect(body).to.deep.equal({ userId: 'user3', theme: 'bright' });
  });
});
