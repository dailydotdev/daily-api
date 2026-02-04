import request from 'supertest';
import { setupPublicApiTests, createTokenForUser } from './helpers';
import { DatasetTool } from '../../../src/entity/dataset/DatasetTool';
import { UserStack } from '../../../src/entity/user/UserStack';

const state = setupPublicApiTests();

// Helper to create a test tool
const createTestTool = async (title: string) => {
  return state.con.getRepository(DatasetTool).save({
    title,
    titleNormalized: title.toLowerCase(),
    faviconUrl: 'https://example.com/icon.png',
  });
};

describe('GET /public/v1/profile/stack', () => {
  it('should return user stack', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .get('/public/v1/profile/stack')
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
      .get('/public/v1/profile/stack')
      .query({ limit: 5 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body.data.length).toBeLessThanOrEqual(5);
  });
});

describe('POST /public/v1/profile/stack', () => {
  it('should add tool to stack', async () => {
    const token = await createTokenForUser(state.con, '5');

    // Create a test tool first
    const tool = await createTestTool('TestStackTool');

    const { body } = await request(state.app.server)
      .post('/public/v1/profile/stack')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: tool.title,
        section: 'primary',
      })
      .expect(200);

    expect(body).toMatchObject({
      id: expect.any(String),
      section: 'primary',
      position: expect.any(Number),
      tool: expect.objectContaining({
        title: tool.title,
      }),
    });
  });

  it('should require title and section', async () => {
    const token = await createTokenForUser(state.con, '5');

    // Server returns 500 for schema validation errors due to global error handler
    await request(state.app.server)
      .post('/public/v1/profile/stack')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Test' })
      .expect(500);

    await request(state.app.server)
      .post('/public/v1/profile/stack')
      .set('Authorization', `Bearer ${token}`)
      .send({ section: 'primary' })
      .expect(500);
  });
});

describe('PATCH /public/v1/profile/stack/:id', () => {
  it('should update stack item', async () => {
    const token = await createTokenForUser(state.con, '5');

    // Create a test tool and add to stack
    const tool = await createTestTool('UpdateStackTool');

    const { body: addBody } = await request(state.app.server)
      .post('/public/v1/profile/stack')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: tool.title,
        section: 'primary',
      })
      .expect(200);

    // Update it
    const { body } = await request(state.app.server)
      .patch(`/public/v1/profile/stack/${addBody.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ section: 'hobby', icon: '🔧' })
      .expect(200);

    expect(body).toMatchObject({
      id: addBody.id,
      section: 'hobby',
      icon: '🔧',
    });
  });
});

describe('DELETE /public/v1/profile/stack/:id', () => {
  it('should delete stack item', async () => {
    const token = await createTokenForUser(state.con, '5');

    // Create a test tool and add to stack
    const tool = await createTestTool('DeleteStackTool');

    const { body: addBody } = await request(state.app.server)
      .post('/public/v1/profile/stack')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: tool.title,
        section: 'primary',
      })
      .expect(200);

    // Delete it
    const { body } = await request(state.app.server)
      .delete(`/public/v1/profile/stack/${addBody.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body).toMatchObject({ success: true });

    // Verify it's deleted
    const item = await state.con.getRepository(UserStack).findOneBy({
      id: addBody.id,
    });
    expect(item).toBeNull();
  });
});

describe('PUT /public/v1/profile/stack/reorder', () => {
  it('should reorder stack items', async () => {
    const token = await createTokenForUser(state.con, '5');

    // Create two test tools and add to stack
    const tool1 = await createTestTool('ReorderTool1');
    const tool2 = await createTestTool('ReorderTool2');

    const { body: add1 } = await request(state.app.server)
      .post('/public/v1/profile/stack')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: tool1.title, section: 'primary' })
      .expect(200);

    const { body: add2 } = await request(state.app.server)
      .post('/public/v1/profile/stack')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: tool2.title, section: 'primary' })
      .expect(200);

    // Reorder
    const { body } = await request(state.app.server)
      .put('/public/v1/profile/stack/reorder')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          { id: add2.id, position: 0 },
          { id: add1.id, position: 1 },
        ],
      })
      .expect(200);

    expect(Array.isArray(body.data)).toBe(true);
  });
});
