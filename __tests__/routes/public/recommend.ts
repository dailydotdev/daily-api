import request from 'supertest';
import nock from 'nock';
import { setupPublicApiTests, createTokenForUser } from './helpers';

const state = setupPublicApiTests();

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

describe('GET /public/v1/recommend/keyword', () => {
  it('should return keyword search results with experimental flag', async () => {
    const token = await createTokenForUser(state.con, '5');
    nockMimir(['p1', 'p2']);

    const { body, headers } = await request(state.app.server)
      .get('/public/v1/recommend/keyword')
      .query({ q: 'javascript' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(2);
    expect(body.data[0]).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      tags: expect.any(Array),
      numUpvotes: expect.any(Number),
      numComments: expect.any(Number),
    });
    expect(body.pagination).toMatchObject({
      hasNextPage: expect.any(Boolean),
    });
    expect(headers['x-daily-experimental']).toBeDefined();
  });

  it('should support limit parameter', async () => {
    const token = await createTokenForUser(state.con, '5');
    nockMimir(['p1']);

    const { body } = await request(state.app.server)
      .get('/public/v1/recommend/keyword')
      .query({ q: 'typescript', limit: 1 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.data.length).toBeLessThanOrEqual(1);
  });

  it('should support time filter', async () => {
    const token = await createTokenForUser(state.con, '5');
    nockMimir(['p1']);

    const { headers } = await request(state.app.server)
      .get('/public/v1/recommend/keyword')
      .query({ q: 'react', time: 'month' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(headers['x-daily-experimental']).toBeDefined();
  });

  it('should return empty data when no results', async () => {
    const token = await createTokenForUser(state.con, '5');
    nockMimir([]);

    const { body } = await request(state.app.server)
      .get('/public/v1/recommend/keyword')
      .query({ q: 'nonexistenttopic' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.data).toEqual([]);
  });

  it('should require authentication', async () => {
    await request(state.app.server)
      .get('/public/v1/recommend/keyword')
      .query({ q: 'test' })
      .expect(401);
  });
});

describe('GET /public/v1/recommend/semantic', () => {
  it('should return semantic search results with experimental flag', async () => {
    const token = await createTokenForUser(state.con, '5');
    nockMimir(['p1', 'p2']);

    const { body, headers } = await request(state.app.server)
      .get('/public/v1/recommend/semantic')
      .query({ q: 'how do I make my chatbot remember things' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(2);
    expect(body.data[0]).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      tags: expect.any(Array),
      numUpvotes: expect.any(Number),
      numComments: expect.any(Number),
    });
    expect(body.pagination).toBeUndefined();
    expect(headers['x-daily-experimental']).toBeDefined();
  });

  it('should support limit parameter', async () => {
    const token = await createTokenForUser(state.con, '5');
    nockMimir(['p1']);

    const { body } = await request(state.app.server)
      .get('/public/v1/recommend/semantic')
      .query({ q: 'what is the best vector database', limit: 1 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.data.length).toBeLessThanOrEqual(1);
  });

  it('should return empty data when no results', async () => {
    const token = await createTokenForUser(state.con, '5');
    nockMimir([]);

    const { body } = await request(state.app.server)
      .get('/public/v1/recommend/semantic')
      .query({ q: 'nonexistenttopic' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.data).toEqual([]);
  });

  it('should require authentication', async () => {
    await request(state.app.server)
      .get('/public/v1/recommend/semantic')
      .query({ q: 'test' })
      .expect(401);
  });
});
