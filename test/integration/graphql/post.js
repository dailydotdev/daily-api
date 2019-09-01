/* eslint-disable */

import { expect } from 'chai';
import supertest from 'supertest';
import knexCleaner from 'knex-cleaner';

import fixture from '../../fixtures/posts';
import fixturePubs from '../../fixtures/publications';
import publication from '../../../src/models/publication';
import post from '../../../src/models/post';
import config from '../../../src/config';
import db, { migrate } from '../../../src/db';
import app from '../../../src';

let server;
let request;

const mapDate = p => Object.assign({}, p, {
  publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
  createdAt: p.createdAt.toISOString(),
});

const latestDate = new Date(fixture.input[1].createdAt.getTime() + 1000).toISOString();

before(() => {
  server = app.listen();
  request = supertest(server);
});

after(() => {
  server.close();
});

beforeEach(async () => {
  await knexCleaner.clean(db, {
    ignoreTables: ['knex_migrations', 'knex_migrations_lock']
  });
  await migrate();
  return Promise.all(fixturePubs.map(pub => publication.add(pub.name, pub.image, pub.enabled)));
});

