/* eslint-disable */

import { expect } from 'chai';
import supertest from 'supertest';
import knexCleaner from 'knex-cleaner';

import fixture from '../../fixtures/posts';
import fixturePubs from '../../fixtures/publications';
import fixtureToilet from '../../fixtures/toilet';
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

const FORBIDDEN_MESSAGE = 'Method is forbidden';

before(() => {
  server = app.listen();
  request = supertest(server);
});

after(() => {
  server.close();
});

beforeEach(async () => {
  // console.log('before each')
  await knexCleaner.clean(db, {
    ignoreTables: ['knex_migrations', 'knex_migrations_lock']
  });
  await migrate();
  return Promise.all(fixturePubs.map(pub => publication.add(pub.name, pub.image, pub.enabled)));
});

// TODO: Change `Query` to `Post`
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

  describe('get bookmarks endpoint', () => {
    const GET_BOOKMARKS = (p) => `
      {
        bookmarks(params: ${p}) {
          ${POST_FIELDS}
          bookmarked
        }
      }
    `;

    it('should throw forbidden without authorization', async () => {
      const params = `{
        latest: ${JSON.stringify((new Date()).toISOString())}
        page: 0,
        pageSize: 20,
      }`;

      const result = await request
        .get('/graphql')
        .query({
          query: GET_BOOKMARKS(params)
        });

      const error = result.body.errors[0];

      expect(error.message).to.be.equal(FORBIDDEN_MESSAGE);
      expect(error.code).to.be.equal(403);
    });

    it('should get bookmarks sorted by time', async () => {
      await Promise.all(fixture.input.map(p => post.add(p)));
      await request.post('/v1/tags/updateCount');

      await post.bookmark(fixture.bookmarks);

      const latest = (new Date(Date.now() + (60 * 60 * 1000))).toISOString();

      const params = `{
        latest: ${JSON.stringify(latest)}
        page: 0,
        pageSize: 20,
      }`;

      const result = await request
        .get('/graphql')
        .set('Authorization', `Service ${config.accessSecret}`)
        .set('User-Id', fixture.bookmarks[0].userId)
        .set('Logged-In', true)
        .query({
          query: GET_BOOKMARKS(params),
        });

      const bookmarks = result.body.data.bookmarks;

      expect(bookmarks).to.have.deep.members(
        [fixture.output[1], fixture.output[0]]
          .map(mapDate)
          .map(x => Object.assign({}, x, { bookmarked: true }))
      );
    });
  });

  describe('set bookmarks endpoint', () => {
      const SET_BOOKMARK = (params) => `
        mutation {
          SetBookmarks(ids: ${params})
        }
      `;

    it('should throw forbidden without authorization', async () => {
      const param = 'foo-id';

      const result = await request
        .post('/graphql')
        .send({
          query: SET_BOOKMARK(JSON.stringify(param)),
        });

      const error = result.body.errors[0];

      expect(error.message).to.be.equal(FORBIDDEN_MESSAGE);
      expect(error.code).to.be.equal(403);
    });

    it('should set bookmarks', async () => {
      await Promise.all(fixture.input.map(p => post.add(p)));

      const postsIds = fixture.bookmarks
        .filter(b => b.userId === fixture.bookmarks[0].userId)
        .map(b => b.postId);

      const result = await request
        .post('/graphql')
        .set('Authorization', `Service ${config.accessSecret}`)
        .set('User-Id', fixture.bookmarks[0].userId)
        .set('Logged-In', true)
        .send({
          query: SET_BOOKMARK(JSON.stringify(postsIds)),
        });

      const returnedIds = result.body.data.SetBookmarks;

      expect(returnedIds).to.deep.equal(postsIds);
    });
  });

  describe('remove bookmark endpoint', () => {
    const DELETE_BOOKMARK = (id) => `
      mutation {
        RemoveBookmark(id: ${id})
      }
    `;

    it('should throw forbidden without authorization', async () => {
      const param = 'foo-id';

      const result = await request
        .post('/graphql')
        .send({
          query: DELETE_BOOKMARK(JSON.stringify(param)),
        });

      const error = result.body.errors[0];

      expect(error.message).to.be.equal(FORBIDDEN_MESSAGE);
      expect(error.code).to.be.equal(403);
    });

    it('should remove bookmark', async () => {
      await Promise.all(fixture.input.map(p => post.add(p)));

      await post.bookmark(fixture.bookmarks);

      const deletedBookmarkId = fixture.bookmarks[0].postId;

      const result = await request
        .post('/graphql')
        .set('Authorization', `Service ${config.accessSecret}`)
        .set('User-Id', fixture.bookmarks[0].userId)
        .set('Logged-In', true)
        .send({
          query: DELETE_BOOKMARK(JSON.stringify(deletedBookmarkId)),
        })

      const returnedId = result.body.data.RemoveBookmark;

      expect(returnedId).to.be.equal(deletedBookmarkId);
    });
  });

  describe('toilet endpoint', () => {
    const GET_TOILET = (params) => `
      {
        toilet(params: ${params}) {
          ${POST_FIELDS}
          type
          bookmarked
        }
      }
    `;

    it('should throw forbidden without authorization', async () => {
      const params = `
        {
          latest: ${JSON.stringify(new Date(Date.now() + (60 * 60 * 1000)))}
          page: 0
        }
      `;

      const result = await request
        .get('/graphql')
        .query({
          query: GET_TOILET(params),
        })

      const error = result.body.errors[0];

      expect(error.message).to.be.equal(FORBIDDEN_MESSAGE);
      expect(error.code).to.be.equal(403);
    });

    it('should get toilet', async () => {
      await Promise.all(fixtureToilet.input.map(p => post.add(p)));
      await request.post('/v1/tags/updateCount');
      await post.bookmark(fixtureToilet.bookmarks);

      const params = `
        {
          latest: ${JSON.stringify(new Date(Date.now() + (60 * 60 * 1000)))}
          page: 0
        }
      `;

      const result = await request
        .get('/graphql')
        .query({
          query: GET_TOILET(params)
        })
        .set('Authorization', `Service ${config.accessSecret}`)
        .set('User-Id', fixtureToilet.bookmarks[0].userId)
        .set('Logged-In', true);

      const data = result.body.data.toilet;

      expect(data).to.deep.equal(
        fixtureToilet.output.map(mapDate).map(x => Object.assign({}, x, { type: 'post' }))
      );
    });
  });

  describe('publication endpoint', () => {
    const FETCH_POST_BY_PUBLICATION = (params) => `
      {
        publication(params: ${params}) {
          ${POST_FIELDS}
        }
      }
    `;

    it('should fetch posts by publication', async () => {
      await Promise.all(fixture.input.map(p => post.add(p)));
      await request.post('/v1/tags/updateCount');

      const params = `
        {
          latest: ${JSON.stringify(latestDate)},
          page: 0
          pageSize: 20
          pub: ${JSON.stringify(fixture.input[1].publicationId)}
        }
      `;

      const result = await request
        .get('/graphql')
        .query({
          query: FETCH_POST_BY_PUBLICATION(params),
        })

      const returnedPosts = result.body.data.publication;

      expect(returnedPosts).to.deep.equal(fixture.pubsOutput.map(mapDate));
    });
  });

  describe('tag endpoint', () => {
    const FETCH_POSTS_BY_TAG = (params) => `
      {
        tag(params: ${params}) {
          ${POST_FIELDS}
        }
      }
    `;

    it('should fetch posts by tag', async () => {
      await Promise.all(fixture.input.map(p => post.add(p)));
      await request.post('/v1/tags/updateCount');

      const params = `
        {
          latest: ${JSON.stringify(latestDate)},
          page: 0
          pageSize: 20
          tag: "a"
        }
      `;

      const result = await request
        .get('/graphql')
        .query({
          query: FETCH_POSTS_BY_TAG(params)
        })

      const returnedPosts = result.body.data.tag;

      expect(returnedPosts).to.deep.equal(fixture.tagsOutput.map(mapDate));
    });
  });
});
