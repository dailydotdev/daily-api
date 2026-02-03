import request from 'supertest';
import { setupPublicApiTests, createTokenForUser } from './helpers';

const state = setupPublicApiTests();

describe('GET /public/v1/posts/:id', () => {
  it('should return post details for valid post ID', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .get('/public/v1/posts/p1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.data).toMatchObject({
      id: 'p1',
      title: 'P1',
    });
  });

  it('should return 404 for non-existent post', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .get('/public/v1/posts/non-existent-post')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    expect(body.error).toBe('not_found');
  });

  it('should include source information in response', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .get('/public/v1/posts/p1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.data.source).toMatchObject({ id: 'a' });
  });

  it('should include bookmarked field in response', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .get('/public/v1/posts/p1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.data).toMatchObject({
      bookmarked: expect.any(Boolean),
    });
  });
});

describe('GET /public/v1/posts/:id/comments', () => {
  it('should return empty comments array for post without comments', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .get('/public/v1/posts/p1/comments')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toMatchObject({
      hasNextPage: expect.any(Boolean),
    });
  });

  it('should support limit and sort parameters', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .get('/public/v1/posts/p1/comments')
      .query({ limit: 10, sort: 'newest' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(body.data)).toBe(true);
  });
});
