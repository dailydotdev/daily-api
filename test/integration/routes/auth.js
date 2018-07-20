import { expect } from 'chai';
import supertest from 'supertest';
import nock from 'nock';
import knexCleaner from 'knex-cleaner';
import db, { migrate } from '../../../src/db';
import provider from '../../../src/models/provider';
import fixture from '../../fixtures/providers';
import app from '../../../src';

describe('auth routes', () => {
  let request;
  let server;

  beforeEach(async () => {
    await knexCleaner.clean(db, { ignoreTables: ['knex_migrations', 'knex_migrations_lock'] });
    await migrate();
    return Promise.all(fixture.map(p =>
      provider.add(p.userId, p.provider, p.accessToken)));
  });

  before(() => {
    server = app.listen();
    request = supertest(server);
  });

  after(() => {
    server.close();
  });

  describe('github', () => {
    it('should throw bad request', async () => {
      await request
        .post('/v1/auth/github/authenticate')
        .expect(400);
    });

    it('should throw forbidden when code is wrong', async () => {
      nock('https://github.com')
        .post('/login/oauth/access_token', () => true)
        .reply(200, {});

      await request
        .post('/v1/auth/github/authenticate')
        .send({ code: 'code', state: 'state' })
        .expect(403);
    });

    it('should return the logged in user', async () => {
      nock('https://github.com')
        .post('/login/oauth/access_token', body => body.code === 'code' && body.state === 'state')
        .reply(200, { access_token: 'token' });

      const res = await request
        .post('/v1/auth/github/authenticate')
        .send({ code: 'code', state: 'state' })
        .expect(200);

      expect(res.body.newUser).to.equal(true);
      const model = await provider.get(res.body.id, 'github');
      expect(model.accessToken).to.equal('token');
    });
  });
});
