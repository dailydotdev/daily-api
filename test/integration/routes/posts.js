import { expect } from 'chai';
import supertest from 'supertest';
import knexCleaner from 'knex-cleaner';
import config from '../../../src/config';
import db, { migrate } from '../../../src/db';
import publication from '../../../src/models/publication';
import post from '../../../src/models/post';
import fixturePubs from '../../fixtures/publications';
import fixture from '../../fixtures/posts';
import fixtureToilet from '../../fixtures/toilet';
import app from '../../../src';

describe('posts routes', () => {
  let request;
  let server;

  const latestDate = new Date(fixture.input[1].createdAt.getTime() + 1000).toISOString();

  beforeEach(async () => {
    await knexCleaner.clean(db, { ignoreTables: ['knex_migrations', 'knex_migrations_lock'] });
    await migrate();
    return Promise.all(fixturePubs.map(pub => publication.add(pub.name, pub.image, pub.enabled)));
  });

  before(() => {
    server = app.listen();
    request = supertest(server);
  });

  after(() => {
    server.close();
  });

  const mapDate = p => Object.assign({}, p, {
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
  });

  it('should fetch latest posts', async () => {
    await Promise.all(fixture.input.map(p => post.add(p)));
    await request.post('/v1/tags/updateCount');

    const result = await request
      .get('/v1/posts/latest')
      .query({ latest: latestDate, page: 0, pageSize: 20 })
      .expect(200);

    expect(result.body).to.deep.equal(fixture.output.map(mapDate));
  });

  it('should fetch latest posts by given tags', async () => {
    await Promise.all(fixture.input.map(p => post.add(p)));
    await request.post('/v1/tags/updateCount');

    const result = await request
      .get('/v1/posts/latest')
      .query({
        latest: fixture.input[1].createdAt.toISOString(),
        page: 0,
        pageSize: 20,
        tags: 'a',
      })
      .expect(200);

    expect(result.body).to.deep.equal([fixture.output[1]].map(mapDate));
  });

  it('should fetch latest posts by given publications', async () => {
    await Promise.all(fixture.input.map(p => post.add(p)));
    await request.post('/v1/tags/updateCount');

    const result = await request
      .get('/v1/posts/latest')
      .query({
        latest: latestDate,
        page: 0,
        pageSize: 20,
        pubs: [fixture.input[1].publicationId].join(','),
      })
      .expect(200);

    expect(result.body).to.deep.equal([fixture.output[0]].map(mapDate));
  });

  describe('get by id endpoint', () => {
    it('should fetch post', async () => {
      await Promise.all(fixture.input.map(p => post.add(p)));
      await request.post('/v1/tags/updateCount');

      const result = await request
        .get(`/v1/posts/${fixture.output[0].id}`)
        .expect(200);

      expect(result.body).to.deep.equal(mapDate(fixture.output[0]));
    });

    it('should return not found when post doesn\'t exist', async () => {
      await request.post('/v1/tags/updateCount');

      const result = await request
        .get('/v1/posts/1234')
        .expect(404);

      expect(result.body.code).to.equal(2);
    });
  });

  describe('get bookmarks endpoint', () => {
    it('should throw forbidden without authorization', async () => {
      await request
        .get('/v1/posts/bookmarks')
        .query({
          latest: new Date(),
          page: 0,
          pageSize: 20,
        })
        .expect(403);
    });

    it('should get bookmarks sorted by time', async () => {
      await Promise.all(fixture.input.map(p => post.add(p)));
      await request.post('/v1/tags/updateCount');

      await post.bookmark(fixture.bookmarks);

      const latest = new Date(Date.now() + (60 * 60 * 1000));

      const res = await request
        .get('/v1/posts/bookmarks')
        .set('Authorization', `Service ${config.accessSecret}`)
        .set('User-Id', fixture.bookmarks[0].userId)
        .set('Logged-In', true)
        .query({
          latest,
          page: 0,
          pageSize: 20,
        })
        .expect(200);

      expect(res.body).to.have.deep.members([fixture.output[1], fixture.output[0]]
        .map(mapDate).map(x => Object.assign({}, x, { bookmarked: true })));
    });
  });

  describe('set bookmarks endpoint', () => {
    it('should throw forbidden without authorization', async () => {
      await request
        .post('/v1/posts/bookmarks')
        .send([])
        .expect(403);
    });

    it('should set bookmarks', async () => {
      await Promise.all(fixture.input.map(p => post.add(p)));

      const body = fixture.bookmarks
        .filter(b => b.userId === fixture.bookmarks[0].userId)
        .map(b => b.postId);

      const res = await request
        .post('/v1/posts/bookmarks')
        .set('Authorization', `Service ${config.accessSecret}`)
        .set('User-Id', fixture.bookmarks[0].userId)
        .set('Logged-In', true)
        .send(body)
        .expect(200);

      expect(res.body).to.deep.equal(body);
    });
  });

  describe('remove bookmark endpoint', () => {
    it('should throw forbidden without authorization', async () => {
      await request
        .post('/v1/posts/bookmarks')
        .send([])
        .expect(403);
    });

    it('should remove bookmark', async () => {
      await Promise.all(fixture.input.map(p => post.add(p)));

      await post.bookmark(fixture.bookmarks);

      await request
        .delete(`/v1/posts/${fixture.bookmarks[0].postId}/bookmark`)
        .set('Authorization', `Service ${config.accessSecret}`)
        .set('User-Id', fixture.bookmarks[0].userId)
        .set('Logged-In', true)
        .expect(204);
    });
  });

  describe('toilet endpoint', () => {
    it('should throw forbidden without authorization', async () => {
      await request
        .get('/v1/posts/toilet')
        .query({
          latest: new Date(Date.now() + (60 * 60 * 1000)),
          page: 0,
        })
        .expect(403);
    });

    it('should get toilet', async () => {
      await Promise.all(fixtureToilet.input.map(p => post.add(p)));
      await request.post('/v1/tags/updateCount');
      await post.bookmark(fixtureToilet.bookmarks);

      const res = await request
        .get('/v1/posts/toilet')
        .query({
          latest: new Date(Date.now() + (60 * 60 * 1000)),
          page: 0,
        })
        .set('Authorization', `Service ${config.accessSecret}`)
        .set('User-Id', fixtureToilet.bookmarks[0].userId)
        .set('Logged-In', true)
        .expect(200);

      expect(res.body).to.deep.equal(fixtureToilet.output.map(mapDate).map(x => Object.assign({}, x, { type: 'post' })));
    });
  });

  it('should fetch posts by publication', async () => {
    await Promise.all(fixture.input.map(p => post.add(p)));
    await request.post('/v1/tags/updateCount');

    const result = await request
      .get('/v1/posts/publication')
      .query({
        latest: latestDate,
        page: 0,
        pageSize: 20,
        pub: fixture.input[1].publicationId,
      })
      .expect(200);

    expect(result.body).to.deep.equal(fixture.pubsOutput.map(mapDate));
  });

  it('should fetch posts by tag', async () => {
    await Promise.all(fixture.input.map(p => post.add(p)));
    await request.post('/v1/tags/updateCount');

    const result = await request
      .get('/v1/posts/tag')
      .query({
        latest: latestDate,
        page: 0,
        pageSize: 20,
        tag: 'a',
      })
      .expect(200);

    expect(result.body).to.deep.equal(fixture.tagsOutput.map(mapDate));
  });

  it('should hide post', async () => {
    await Promise.all(fixture.input.map(p => post.add(p)));

    await request
      .post(`/v1/posts/${fixture.input[0].id}/hide`)
      .set('Authorization', `Service ${config.accessSecret}`)
      .set('User-Id', '1')
      .set('Logged-In', true)
      .expect(204);
  });
});
