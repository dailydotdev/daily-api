import { expect } from 'chai';
import sinon from 'sinon';
import supertest from 'supertest';
import knexCleaner from 'knex-cleaner';

import fixture from '../../fixtures/posts';
import fixturePubs from '../../fixtures/publications';
import fixtureToilet from '../../fixtures/toilet';
import * as algolia from '../../../src/algolia';
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
const NOT_FOUND_MESSAGE = id => `No post found that matches id: ${id}`;

// TODO: mutations for `await request.post('/v1/tags/updateCount');`

describe('graphql post', () => {
  const POST_FIELDS = `
    id
    title
    url
    publishedAt
    createdAt
    image
    ratio
    placeholder
    views
    readTime
    publication {
      id
      name
      image
    }
    tags
  `;

  before(() => {
    server = app.listen();
    request = supertest(server);
  });

  after(() => {
    server.close();
  });

  beforeEach(async () => {
    await knexCleaner.clean(db, {
      ignoreTables: ['knex_migrations', 'knex_migrations_lock'],
    });
    await migrate();
    return Promise.all(fixturePubs.map(pub => publication.add(pub.name, pub.image, pub.enabled)));
  });

  describe('latest query', () => {
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
      }`;

      const result = await request
        .get('/graphql')
        .query({
          query: GET_LATEST(params),
        })
        .expect(200);

      const { latest } = result.body.data;

      expect(latest.length).to.equal(1);
      expect(latest).to.deep.equal([fixture.output[1]].map(mapDate));
    });

    it('should fetch latest posts', async () => {
      await Promise.all(fixture.input.map(p => post.add(p)));
      await request.post('/v1/tags/updateCount');

      const params = `{
        latest: ${JSON.stringify(latestDate)}
        page: 0,
        pageSize: 20,
      }`;

      const result = await request
        .get('/graphql')
        .query({
          query: GET_LATEST(params),
        })
        .expect(200);

      const { latest } = result.body.data;

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
          query: GET_LATEST(params),
        })
        .expect(200);

      const { latest } = result.body.data;
      expect(latest).to.deep.equal([fixture.output[2]].map(mapDate));
    });

    it('should fetch latest posts sorted by creation time', async () => {
      await Promise.all(fixture.input.map(p => post.add(p)));
      await request.post('/v1/tags/updateCount');

      const params = `{
        latest: ${JSON.stringify(latestDate)}
        page: 0,
        pageSize: 20,
        sortBy: "creation",
      }`;

      const result = await request
        .get('/graphql')
        .query({
          query: GET_LATEST(params),
        })
        .expect(200);

      const { latest } = result.body.data;

      expect(latest).to.deep.equal(fixture.outputByCreation.map(mapDate));
    });
  });

  describe('get post query', () => {
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
          query: GET_POST_BY_ID(postId),
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
          query: GET_POST_BY_ID(postId),
        });

      const [error] = result.body.errors;

      expect(error.message).to.be.equal(NOT_FOUND_MESSAGE(postId));
      expect(error.code).to.be.equal(404);
    });
  });

  describe('bookmarks query', () => {
    const GET_BOOKMARKS = p => `
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
          query: GET_BOOKMARKS(params),
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

      const { bookmarks } = result.body.data;

      expect(bookmarks).to.have.deep.members([fixture.output[2], fixture.output[1]]
        .map(mapDate)
        .map(x => Object.assign({}, x, { bookmarked: true })));
    });
  });

  describe('set bookmarks mutation', () => {
    const SET_BOOKMARK = params => `
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

  describe('remove bookmark mutation', () => {
    const DELETE_BOOKMARK = id => `
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
        });

      const returnedId = result.body.data.RemoveBookmark;

      expect(returnedId).to.be.equal(deletedBookmarkId);
    });
  });

  describe('toilet query', () => {
    const GET_TOILET = params => `
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
        });

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
          query: GET_TOILET(params),
        })
        .set('Authorization', `Service ${config.accessSecret}`)
        .set('User-Id', fixtureToilet.bookmarks[0].userId)
        .set('Logged-In', true);

      const data = result.body.data.toilet;

      expect(data).to.deep.equal(fixtureToilet.output.map(mapDate).map(x => Object.assign({}, x, { type: 'post' })));
    });
  });

  describe('posts by publication query', () => {
    const FETCH_POST_BY_PUBLICATION = params => `
      {
        postsByPublication(params: ${params}) {
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
        });

      const returnedPosts = result.body.data.postsByPublication;

      expect(returnedPosts).to.deep.equal(fixture.pubsOutput.map(mapDate));
    });
  });

  describe('posts by tag query', () => {
    const FETCH_POSTS_BY_TAG = params => `
      {
        postsByTag(params: ${params}) {
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
          query: FETCH_POSTS_BY_TAG(params),
        });

      const returnedPosts = result.body.data.postsByTag;

      expect(returnedPosts).to.deep.equal(fixture.tagsOutput.map(mapDate));
    });
  });

  describe('posts search query', () => {
    const FETCH_POSTS_BY_QUERY = params => `
      {
        search(params: ${params}) {
          query
          hits {
            ${POST_FIELDS}
          }
        }
      }
    `;

    it('should fetch posts by text query', async () => {
      await Promise.all(fixture.input.map(p => post.add(p)));
      await request.post('/v1/tags/updateCount');

      const stub = sinon.stub(algolia, 'getPostsIndex').returns({
        search: () => ({ hits: fixture.searchOutput.map(p => ({ objectID: p.id })) }),
      });

      const params = `
        {
          latest: ${JSON.stringify(latestDate)},
          page: 0
          pageSize: 20
          query: "text"
        }
      `;

      const result = await request
        .get('/graphql')
        .query({
          query: FETCH_POSTS_BY_QUERY(params),
        });

      const returnedPosts = result.body.data.search;
      stub.restore();
      expect(returnedPosts).to.deep.equal({
        query: 'text',
        hits: fixture.searchOutput.map(mapDate),
      });
    });
  });

  describe('search suggestions query', () => {
    const FETCH_SEARCH_SUGGESTIONS_QUERY = params => `
      {
        searchSuggestion(params: ${params}) {
          query
          hits { title }
        }
      }
    `;

    it('should fetch search suggestions', async () => {
      const stub = sinon.stub(algolia, 'getPostsIndex').returns({
        search: () => ({
          hits: fixture.searchOutput.map(p => ({
            objectID: p.id,
            title: p.title,
            _highlightResult: { title: { value: p.title } },
          })),
        }),
      });

      const params = `
        {
          query: "text"
        }
      `;

      const result = await request
        .get('/graphql')
        .query({
          query: FETCH_SEARCH_SUGGESTIONS_QUERY(params),
        });

      const returnedPosts = result.body.data.searchSuggestion;
      stub.restore();
      expect(returnedPosts).to.deep.equal({
        query: 'text',
        hits: fixture.searchOutput.map(p => ({ title: p.title })),
      });
    });
  });

  describe('hide post mutation', () => {
    const HIDE_POST = id => `
      mutation {
        HidePost(id: ${id})
      }
    `;

    it('should hide post', async () => {
      await Promise.all(fixture.input.map(p => post.add(p)));

      const hiddenPostId = fixture.input[0].id;

      const result = await request
        .post('/graphql')
        .set('Authorization', `Service ${config.accessSecret}`)
        .set('User-Id', '1')
        .set('Logged-In', true)
        .send({
          query: HIDE_POST(hiddenPostId),
        });

      const returnedPostId = result.body.data.HidePost;

      expect(returnedPostId).to.be.equal(hiddenPostId);
    });

    it('should return not found when post doesn\'t exist', async () => {
      await Promise.all(fixture.input.map(p => post.add(p)));

      const nonExistentPostId = '3123112';

      const result = await request
        .post('/graphql')
        .set('Authorization', `Service ${config.accessSecret}`)
        .set('User-Id', '1')
        .set('Logged-In', true)
        .send({
          query: HIDE_POST(nonExistentPostId),
        });

      const [error] = result.body.errors;

      expect(error.message).to.be.equal(NOT_FOUND_MESSAGE(nonExistentPostId));
      expect(error.code).to.be.equal(404);
    });
  });
});
