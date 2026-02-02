import request from 'supertest';
import { setupPublicApiTests, createTokenForUser } from './helpers';

const state = setupPublicApiTests();

describe('GET /public/v1/feed', () => {
  it('should return feed with posts', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .get('/public/v1/feed')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.pagination).toMatchObject({
      hasNextPage: expect.any(Boolean),
    });
  });

  it('should support pagination with limit parameter', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .get('/public/v1/feed')
      .query({ limit: 2 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.data.length).toBeLessThanOrEqual(2);
  });

  it('should support cursor-based pagination', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body: body1 } = await request(state.app.server)
      .get('/public/v1/feed')
      .query({ limit: 2 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    if (body1.pagination.cursor) {
      const { body: body2 } = await request(state.app.server)
        .get('/public/v1/feed')
        .query({ limit: 2, cursor: body1.pagination.cursor })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      if (body1.data.length > 0 && body2.data.length > 0) {
        expect(body1.data[0].id).not.toBe(body2.data[0].id);
      }
    }
  });

  it('should include post metadata in response', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .get('/public/v1/feed')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const post = body.data[0];
    expect(post).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
    });
  });
});
