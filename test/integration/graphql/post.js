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

describe('Query', () => {
  const POST_FIELDS = `
    id
    title
    url
    publishedAt: published_at
    createdAt: created_at
    image
    ratio
    placeholder
    views
    readTime: read_time
    publication {
      id
      name
      image
    }
    tags
  `;

  // TODO: mutations for `await request.post('/v1/tags/updateCount');`
  describe('latest', () => {

    const GET_LATEST = p => `
    {
      latest(params: ${p}) {
        ${POST_FIELDS}
      }
    }
  `;

    it('should fetch latest posts by given publications', async () => {
      expect(true).to.be.equal(true);

      await Promise.all(fixture.input.map(p => post.add(p)));
      await request.post('/v1/tags/updateCount');

      const params = `{
        latest: ${JSON.stringify(latestDate)}
        page: 0,
        pageSize: 20,
        pubs: ${JSON.stringify([fixture.input[1].publicationId].join(','))},
      }`

      const result = await request
        .get('/graphql')
        .query({
          query: GET_LATEST(params)
        })
        .expect(200);

      const latest = result.body.data.latest;

      expect(latest.length).to.equal(1);
      expect(latest).to.deep.equal([fixture.output[0]].map(mapDate));
    });

    it('should fetch latest posts', async () => {
      await Promise.all(fixture.input.map(p => post.add(p)));
      await request.post('/v1/tags/updateCount');

      const params = `{
        latest: ${JSON.stringify(latestDate)}
        page: 0,
        pageSize: 20,
      }`

      const result = await request
        .get('/graphql')
        .query({
          query: GET_LATEST(params)
        })
        .expect(200);

      const latest = result.body.data.latest;

      expect(latest).to.deep.equal(fixture.output.map(mapDate));
    });

    it('should fetch latest posts by given tags', async () => {
      await Promise.all(fixture.input.map(p => post.add(p)));
      await request.post('/v1/tags/updateCount');

      const params = `{
        latest: ${JSON.stringify(fixture.input[1].createdAt.toISOString())}
        page: 0,
        pageSize: 20,
        tags: "a",
      }`;

      const result = await request
        .get('/graphql')
        .query({
          query: GET_LATEST(params)
        })
        .expect(200);

      const latest = result.body.data.latest;
      expect(latest).to.deep.equal([fixture.output[1]].map(mapDate));
    });
  });

  describe('get by id endpoint', () => {
    const NOT_FOUND_MESSAGE = id => `No post found that matches id: ${id}`;

    const GET_POST_BY_ID = id => `
      {
        post(id: ${id}) {
          ${POST_FIELDS}
        }
      }
    `;

    it('should fetch post', async () => {
      await Promise.all(fixture.input.map(p => post.add(p)));
      await request.post('/v1/tags/updateCount');

      const postId = fixture.output[0].id;

      const result = await request
        .get('/graphql')
        .query({
          query: GET_POST_BY_ID(postId)
        })
        .expect(200);

      expect(result.body.data.post).to.deep.equal(mapDate(fixture.output[0]));
    });

    it('should return not found when post doesn\'t exist', async () => {
      await request.post('/v1/tags/updateCount');

      const postId = 1234;

      const result = await request
        .get('/graphql')
        .query({
          query: GET_POST_BY_ID(postId)
        });

      const [error] = result.body.errors;

      expect(error.message).to.be.equal(NOT_FOUND_MESSAGE(postId));
      expect(error.code).to.be.equal(404);
    });
  });

