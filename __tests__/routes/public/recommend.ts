import request from 'supertest';
import nock from 'nock';
import { setupPublicApiTests, createTokenForUser } from './helpers';

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

describe('GET /public/v1/recommend/keyword', () => {
  it('should return posts matching mimir results with correct fields', async () => {
    const token = await createTokenForUser(state.con, '5');
    nockMimir(['p1', 'p2']);

    const { body, headers } = await request(state.app.server)
      .get('/public/v1/recommend/keyword')
      .query({ q: 'javascript' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(headers['x-daily-experimental']).toBeDefined();
    expect(body.data).toHaveLength(2);
    expect(body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'p1',
          title: 'P1',
          url: 'http://p1.com',
          image: 'https://daily.dev/image.jpg',
          type: 'article',
          tags: ['javascript', 'webdev'],
          source: expect.objectContaining({
            id: 'a',
            name: 'A',
            handle: 'a',
          }),
        }),
        expect.objectContaining({
          id: 'p2',
          title: 'P2',
          url: 'http://p2.com',
          source: expect.objectContaining({
            id: 'b',
            name: 'B',
          }),
        }),
      ]),
    );
    expect(body.pagination).toMatchObject({
      hasNextPage: expect.any(Boolean),
      cursor: expect.any(String),
    });
  });

  it('should respect limit parameter', async () => {
    const token = await createTokenForUser(state.con, '5');
    // Mimir receives limit=2 and returns 2 results
    nockMimir(['p1', 'p2']);

    const { body } = await request(state.app.server)
      .get('/public/v1/recommend/keyword')
      .query({ q: 'typescript', limit: 2 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.data).toHaveLength(2);
    expect(body.data[0]).toMatchObject({ id: 'p1' });
    expect(body.data[1]).toMatchObject({ id: 'p2' });
  });

  it('should pass time filter to search', async () => {
    const token = await createTokenForUser(state.con, '5');
    nockMimir(['p1']);

    const { body, headers } = await request(state.app.server)
      .get('/public/v1/recommend/keyword')
      .query({ q: 'react', time: 'month' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(headers['x-daily-experimental']).toBeDefined();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      id: 'p1',
      title: 'P1',
    });
  });

  it('should not return private posts', async () => {
    const token = await createTokenForUser(state.con, '5');
    // p6 is private
    nockMimir(['p1', 'p6']);

    const { body } = await request(state.app.server)
      .get('/public/v1/recommend/keyword')
      .query({ q: 'test' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe('p1');
  });

  it('should return empty data when no mimir results', async () => {
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
  it('should return posts matching mimir results with correct fields', async () => {
    const token = await createTokenForUser(state.con, '5');
    nockMimir(['p1', 'p2']);

    const { body, headers } = await request(state.app.server)
      .get('/public/v1/recommend/semantic')
      .query({ q: 'how do I make my chatbot remember things' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(headers['x-daily-experimental']).toBeDefined();
    expect(body.data).toHaveLength(2);
    expect(body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'p1',
          title: 'P1',
          url: 'http://p1.com',
          tags: ['javascript', 'webdev'],
          source: expect.objectContaining({ id: 'a', name: 'A' }),
        }),
        expect.objectContaining({
          id: 'p2',
          title: 'P2',
          url: 'http://p2.com',
          source: expect.objectContaining({ id: 'b', name: 'B' }),
        }),
      ]),
    );
    expect(body.pagination).toBeUndefined();
  });

  it('should respect limit parameter', async () => {
    const token = await createTokenForUser(state.con, '5');
    // Mimir receives limit=2 and returns 2 results
    nockMimir(['p1', 'p2']);

    const { body } = await request(state.app.server)
      .get('/public/v1/recommend/semantic')
      .query({ q: 'what is the best vector database', limit: 2 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.data).toHaveLength(2);
    expect(body.data[0]).toMatchObject({ id: 'p1' });
    expect(body.data[1]).toMatchObject({ id: 'p2' });
  });

  it('should return empty data when no mimir results', async () => {
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
