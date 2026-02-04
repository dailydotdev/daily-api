import request from 'supertest';
import { setupPublicApiTests, createTokenForUser } from './helpers';
import { Feed } from '../../../src/entity/Feed';

const state = setupPublicApiTests();

describe('POST /public/v1/feeds/custom', () => {
  it('should create a new custom feed', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .post('/public/v1/feeds/custom')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Feed', icon: '🚀' })
      .expect(200);

    expect(body).toMatchObject({
      id: expect.any(String),
      userId: '5',
      flags: expect.objectContaining({
        name: 'Test Feed',
        icon: '🚀',
      }),
    });
  });

  it('should require name', async () => {
    const token = await createTokenForUser(state.con, '5');

    // Server returns 500 for schema validation errors due to global error handler
    await request(state.app.server)
      .post('/public/v1/feeds/custom')
      .set('Authorization', `Bearer ${token}`)
      .send({ icon: '🚀' })
      .expect(500);
  });
});

describe('GET /public/v1/feeds/custom', () => {
  it('should list user custom feeds', async () => {
    const token = await createTokenForUser(state.con, '5');

    // Create a feed first
    await request(state.app.server)
      .post('/public/v1/feeds/custom')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'List Test Feed' })
      .expect(200);

    const { body } = await request(state.app.server)
      .get('/public/v1/feeds/custom')
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
      .get('/public/v1/feeds/custom')
      .query({ limit: 5 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.data.length).toBeLessThanOrEqual(5);
  });
});

describe('GET /public/v1/feeds/custom/:feedId', () => {
  // This test requires external feed service on port 6000 which isn't available in tests
  it.skip('should get custom feed posts', async () => {
    const token = await createTokenForUser(state.con, '5');

    // Create a feed first
    const { body: createBody } = await request(state.app.server)
      .post('/public/v1/feeds/custom')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Posts Test Feed' })
      .expect(200);

    const { body } = await request(state.app.server)
      .get(`/public/v1/feeds/custom/${createBody.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toMatchObject({
      hasNextPage: expect.any(Boolean),
    });
  });
});

describe('GET /public/v1/feeds/custom/:feedId/info', () => {
  it('should get custom feed metadata', async () => {
    const token = await createTokenForUser(state.con, '5');

    // Create a feed first
    const { body: createBody } = await request(state.app.server)
      .post('/public/v1/feeds/custom')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Info Test Feed', icon: '🚀' })
      .expect(200);

    const { body } = await request(state.app.server)
      .get(`/public/v1/feeds/custom/${createBody.id}/info`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body).toMatchObject({
      id: createBody.id,
      userId: '5',
      flags: expect.objectContaining({
        name: 'Info Test Feed',
        icon: '🚀',
      }),
    });
  });

  it('should return 404 for non-existent feed', async () => {
    const token = await createTokenForUser(state.con, '5');

    await request(state.app.server)
      .get('/public/v1/feeds/custom/non-existent-id/info')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});

describe('PATCH /public/v1/feeds/custom/:feedId', () => {
  it('should update custom feed settings', async () => {
    const token = await createTokenForUser(state.con, '5');

    // Create a feed first
    const { body: createBody } = await request(state.app.server)
      .post('/public/v1/feeds/custom')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Update Test Feed' })
      .expect(200);

    const { body } = await request(state.app.server)
      .patch(`/public/v1/feeds/custom/${createBody.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Feed Name', icon: '💡' })
      .expect(200);

    expect(body.flags).toMatchObject({
      name: 'Updated Feed Name',
      icon: '💡',
    });
  });
});

describe('DELETE /public/v1/feeds/custom/:feedId', () => {
  it('should delete a custom feed', async () => {
    const token = await createTokenForUser(state.con, '5');

    // Create a feed first
    const { body: createBody } = await request(state.app.server)
      .post('/public/v1/feeds/custom')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Delete Test Feed' })
      .expect(200);

    const { body } = await request(state.app.server)
      .delete(`/public/v1/feeds/custom/${createBody.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body).toMatchObject({ success: true });

    // Verify it's deleted
    const feed = await state.con.getRepository(Feed).findOneBy({
      id: createBody.id,
    });
    expect(feed).toBeNull();
  });
});
