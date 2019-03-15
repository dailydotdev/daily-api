import { expect } from 'chai';
import supertest from 'supertest';
import knexCleaner from 'knex-cleaner';
import db, { migrate } from '../../../src/db';
import notification from '../../../src/models/notification';
import fixture from '../../fixtures/notifications';
import app from '../../../src';

describe('notifications routes', () => {
  let request;
  let server;

  beforeEach(async () => {
    await knexCleaner.clean(db, { ignoreTables: ['knex_migrations', 'knex_migrations_lock'] });
    await migrate();
    return Promise.all(fixture.map(n => notification.add(n)));
  });

  before(() => {
    server = app.listen();
    request = supertest(server);
  });

  after(() => {
    server.close();
  });

  const mapDate = p => Object.assign({}, p, {
    timestamp: p.timestamp.toISOString(),
  });

  it('should return notifications', async () => {
    const { body } = await request
      .get('/v1/notifications')
      .expect(200);

    expect(body).to.deep.equal(fixture.slice(0, 5).map(mapDate));
  });

  it('should return notifications', async () => {
    const { body } = await request
      .get('/v1/notifications')
      .expect(200);

    expect(body).to.deep.equal(fixture.slice(0, 5).map(mapDate));
  });

  it('should return notifications since', async () => {
    const { body } = await request
      .get('/v1/notifications')
      .query({ since: (new Date(2017, 10, 21, 15, 58, 0)).toISOString() })
      .expect(200);

    expect(body).to.deep.equal(fixture.slice(0, 5).map(mapDate));
  });

  it('should return latest notification', async () => {
    const { body } = await request
      .get('/v1/notifications')
      .query({ since: (new Date(2017, 10, 21, 19, 23, 5)).toISOString() })
      .expect(200);

    expect(body).to.deep.equal([fixture[0]].map(mapDate));
  });
});
