import { expect } from 'chai';
import supertest from 'supertest';
import nock from 'nock';
import knexCleaner from 'knex-cleaner';
import db, { migrate } from '../../../src/db';
import provider from '../../../src/models/provider';
import app from '../../../src';
import refreshToken from '../../../src/models/refreshToken';

describe('auth routes', () => {
  let request;
  let server;

  beforeEach(async () => {
    await knexCleaner.clean(db, { ignoreTables: ['knex_migrations', 'knex_migrations_lock'] });
    return migrate();
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

    it('should register a new user', async () => {
      nock('https://github.com')
        .post('/login/oauth/access_token', body => body.code === 'code')
        .reply(200, { access_token: 'token' });

      nock('https://api.github.com', {
        reqheaders: {
          'User-Agent': 'Daily',
        },
      })
        .get('/user')
        .query({ access_token: 'token' })
        .reply(200, { id: 'github_id' });

      const res = await request
        .post('/v1/auth/github/authenticate')
        .send({ code: 'code' })
        .expect(200);

      expect(res.body.newUser).to.equal(true);
      const model = await provider.getByUserId(res.body.id, 'github');
      expect(model.accessToken).to.equal('token');
      expect(model.providerId).to.equal('github_id');
    });

    it('should login the existing in user', async () => {
      nock('https://github.com')
        .post('/login/oauth/access_token', body => body.code === 'code')
        .reply(200, { access_token: 'token' });

      nock('https://api.github.com')
        .get('/user')
        .query({ access_token: 'token' })
        .reply(200, { id: 'github_id' });

      await request
        .post('/v1/auth/github/authenticate')
        .send({ code: 'code' })
        .expect(200);

      nock('https://github.com')
        .post('/login/oauth/access_token', body => body.code === 'code')
        .reply(200, { access_token: 'token2' });

      nock('https://api.github.com')
        .get('/user')
        .query({ access_token: 'token2' })
        .reply(200, { id: 'github_id' });

      const res = await request
        .post('/v1/auth/github/authenticate')
        .send({ code: 'code' })
        .expect(200);

      expect(res.body.newUser).to.equal(false);
      const model = await provider.getByUserId(res.body.id, 'github');
      expect(model.accessToken).to.equal('token2');
    });
  });

  describe('refresh token', () => {
    it('should throw 403 when no such refresh token', async () => {
      await request
        .post('/v1/auth/refresh')
        .send({ refreshToken: 'refresh' })
        .expect(403);
    });

    it('should send a new access token', async () => {
      await refreshToken.add('user', 'refresh2');

      await request
        .post('/v1/auth/refresh')
        .send({ refreshToken: 'refresh2' })
        .expect(200);
    });
  });
});
