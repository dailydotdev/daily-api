import { expect } from 'chai';
import supertest from 'supertest';
import nock from 'nock';
import knexCleaner from 'knex-cleaner';
import db, { migrate } from '../../../src/db';
import provider from '../../../src/models/provider';
import app from '../../../src';
import fixture from '../../fixtures/providers';

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

      await request
        .post('/v1/auth/github/authenticate')
        .send({ code: 'code' })
        .expect(200);

      nock('https://api.github.com')
        .post('/user')
        .query({ acess_token: 'token' })
        .reply(200, { name: 'token_client', avatar_url: 'https://avatar.com' });

      await provider.add(
        p.userId,
        'github',
        'token',
        'idg',
        new Date(60 * 60 * 1000),
        'refresh',
      );

      await request
        .get('/v1/users/me')
        .expect(200);
    });
  });
});
