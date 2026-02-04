import request from 'supertest';
import { setupPublicApiTests, createTokenForUser } from './helpers';

const state = setupPublicApiTests();

describe('GET /public/v1/profile', () => {
  it('should return current user profile', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .get('/public/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body).toMatchObject({
      id: '5',
      name: expect.any(String),
      permalink: expect.any(String),
      socialLinks: expect.any(Array),
    });
  });

  it('should include social links', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .get('/public/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(body.socialLinks)).toBe(true);
  });
});

describe('PATCH /public/v1/profile', () => {
  it('should update user profile', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .patch('/public/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated Test Name',
        bio: 'Test bio',
      })
      .expect(200);

    expect(body).toMatchObject({
      id: '5',
      name: 'Updated Test Name',
      bio: 'Test bio',
    });
  });

  it('should update social links', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .patch('/public/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        socialLinks: [
          { url: 'https://github.com/testuser' },
          { url: 'https://twitter.com/testuser' },
        ],
      })
      .expect(200);

    expect(body.socialLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          platform: 'github',
          url: 'https://github.com/testuser',
        }),
        expect.objectContaining({
          platform: 'twitter',
          url: expect.stringContaining('twitter.com'),
        }),
      ]),
    );
  });

  it('should handle partial updates', async () => {
    const token = await createTokenForUser(state.con, '5');

    // First update
    await request(state.app.server)
      .patch('/public/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: 'First bio' })
      .expect(200);

    // Second update (only name)
    const { body } = await request(state.app.server)
      .patch('/public/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Name Only' })
      .expect(200);

    expect(body.name).toBe('New Name Only');
  });
});
