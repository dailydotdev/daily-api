import { expect } from 'chai';
import supertest from 'supertest';
import nock from 'nock';
import knexCleaner from 'knex-cleaner';
import db, { migrate } from '../../../src/db';
import app from '../../../src';

describe('users routes', () => {
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

  describe('me', () => {
    it('should return github profile', async () => {
      nock('https://github.com')
        .post('/login/oauth/access_token', body => body.code === 'code')
        .reply(200, { access_token: 'token' });

      nock('https://api.github.com')
        .get('/user')
        .query({ access_token: 'token' })
        .reply(200, { id: 'github_id', name: 'user', avatar_url: 'https://avatar.com' });

      const { body } = await request
        .post('/v1/auth/github/authenticate')
        .send({ code: 'code' })
        .expect(200);

      nock('https://api.github.com')
        .get('/user')
        .query({ access_token: 'token' })
        .reply(200, { id: 'github_id', name: 'user', avatar_url: 'https://avatar.com' });

      const res = await request
        .get('/v1/users/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);

      expect(res.body).to.deep.equal({
        id: body.id,
        providers: ['github'],
        name: 'user',
        image: 'https://avatar.com',
      });
    });
  });
});
