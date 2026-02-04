import request from 'supertest';
import { setupPublicApiTests, createTokenForUser } from './helpers';

const state = setupPublicApiTests();

describe('GET /public/v1/notifications', () => {
  it('should return notifications list', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .get('/public/v1/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toMatchObject({
      hasNextPage: expect.any(Boolean),
    });
  });

  it('should support pagination', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .get('/public/v1/notifications')
      .query({ limit: 5 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.data.length).toBeLessThanOrEqual(5);
  });
});

describe('GET /public/v1/notifications/unread/count', () => {
  it('should return unread count', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .get('/public/v1/notifications/unread/count')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body).toMatchObject({
      count: expect.any(Number),
    });
    expect(body.count).toBeGreaterThanOrEqual(0);
  });
});

describe('POST /public/v1/notifications/read', () => {
  it('should mark all notifications as read', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .post('/public/v1/notifications/read')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body).toMatchObject({ success: true });
  });
});
