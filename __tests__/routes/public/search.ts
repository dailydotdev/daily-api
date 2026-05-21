import request from 'supertest';
import nock from 'nock';
import { setupPublicApiTests, createTokenForUser } from './helpers';
import { Keyword } from '../../../src/entity';

const state = setupPublicApiTests();

afterEach(() => {
  nock.cleanAll();
});

const nockMimir = (postIds: string[]) => {
  nock('http://localhost:7600')
    .post('/v1/search')
    .reply(
      204,
      JSON.stringify({
        result: postIds.map((postId) => ({ postId })),
      }),
    );
};

describe('GET /public/v1/search/posts', () => {
  it('should return search results for posts', async () => {
    const token = await createTokenForUser(state.con, '5');
    nockMimir(['p1', 'p2']);

    const { body } = await request(state.app.server)
      .get('/public/v1/search/posts')
      .query({ q: 'P1' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0]).toMatchObject({ id: 'p1' });
    expect(body.pagination).toMatchObject({
      hasNextPage: expect.any(Boolean),
    });
  });

  // Regression test: TIME_MAP previously emitted DAY/WEEK/MONTH/YEAR/ALL
  // which are not valid values of the SearchTime GraphQL enum. Every request
  // with ?time=… returned a 500 (GraphQL variable validation error).
  // See src/routes/public/search.ts TIME_MAP and src/schema/search.ts SearchTime.
  it.each(['day', 'week', 'month', 'year', 'all'])(
    'should accept time=%s and not return 500',
    async (time) => {
      const token = await createTokenForUser(state.con, '5');
      nockMimir(['p1']);

      const { body } = await request(state.app.server)
        .get('/public/v1/search/posts')
        .query({ q: 'foo', time })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(body.data)).toBe(true);
    },
  );

  it('should reject unknown time values with 400', async () => {
    const token = await createTokenForUser(state.con, '5');

    await request(state.app.server)
      .get('/public/v1/search/posts')
      .query({ q: 'foo', time: 'forever' })
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('should require authentication', async () => {
    await request(state.app.server)
      .get('/public/v1/search/posts')
      .query({ q: 'test' })
      .expect(401);
  });
});

describe('GET /public/v1/search/tags', () => {
  beforeEach(async () => {
    await state.con.getRepository(Keyword).save([
      { value: 'javascript', status: 'allow' },
      { value: 'java', status: 'allow' },
      { value: 'typescript', status: 'allow' },
    ]);
  });

  it('should return matching tags', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .get('/public/v1/search/tags')
      .query({ q: 'java' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(body.data)).toBe(true);
    // Tags should have name property
    if (body.data.length > 0) {
      expect(body.data[0]).toHaveProperty('name');
    }
  });

  it('should return empty array for short query', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .get('/public/v1/search/tags')
      .query({ q: 'j' }) // Single character should return empty
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.data).toEqual([]);
  });
});

describe('GET /public/v1/search/sources', () => {
  it('should return matching sources', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .get('/public/v1/search/sources')
      .query({ q: 'A' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(body.data)).toBe(true);
    // Sources should have id, name, handle properties
    if (body.data.length > 0) {
      expect(body.data[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        handle: expect.any(String),
      });
    }
  });

  it('should support limit parameter', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .get('/public/v1/search/sources')
      .query({ q: 'community', limit: 1 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.data.length).toBeLessThanOrEqual(1);
  });
});
