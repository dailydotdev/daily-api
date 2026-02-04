import request from 'supertest';
import { setupPublicApiTests, createTokenForUser } from './helpers';

const state = setupPublicApiTests();

describe('GET /public/v1/feeds/filters', () => {
  it('should get global feed settings', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .get('/public/v1/feeds/filters')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body).toMatchObject({
      includeTags: expect.any(Array),
      blockedTags: expect.any(Array),
    });
  });
});

describe('POST /public/v1/feeds/filters/tags/follow', () => {
  it('should follow tags globally', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .post('/public/v1/feeds/filters/tags/follow')
      .set('Authorization', `Bearer ${token}`)
      .send({ tags: ['webdev', 'development'] })
      .expect(200);

    expect(body).toMatchObject({ success: true });
  });

  it('should require tags array', async () => {
    const token = await createTokenForUser(state.con, '5');

    // Server returns 500 for schema validation errors due to global error handler
    await request(state.app.server)
      .post('/public/v1/feeds/filters/tags/follow')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(500);
  });
});

describe('POST /public/v1/feeds/filters/tags/unfollow', () => {
  it('should unfollow tags globally', async () => {
    const token = await createTokenForUser(state.con, '5');

    // First follow some tags
    await request(state.app.server)
      .post('/public/v1/feeds/filters/tags/follow')
      .set('Authorization', `Bearer ${token}`)
      .send({ tags: ['rust'] })
      .expect(200);

    // Then unfollow
    const { body } = await request(state.app.server)
      .post('/public/v1/feeds/filters/tags/unfollow')
      .set('Authorization', `Bearer ${token}`)
      .send({ tags: ['rust'] })
      .expect(200);

    expect(body).toMatchObject({ success: true });
  });
});

describe('POST /public/v1/feeds/filters/tags/block', () => {
  it('should block tags globally', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .post('/public/v1/feeds/filters/tags/block')
      .set('Authorization', `Bearer ${token}`)
      .send({ tags: ['golang'] })
      .expect(200);

    expect(body).toMatchObject({ success: true });
  });
});

describe('POST /public/v1/feeds/filters/tags/unblock', () => {
  it('should unblock tags globally', async () => {
    const token = await createTokenForUser(state.con, '5');

    // First block
    await request(state.app.server)
      .post('/public/v1/feeds/filters/tags/block')
      .set('Authorization', `Bearer ${token}`)
      .send({ tags: ['fullstack'] })
      .expect(200);

    // Then unblock
    const { body } = await request(state.app.server)
      .post('/public/v1/feeds/filters/tags/unblock')
      .set('Authorization', `Bearer ${token}`)
      .send({ tags: ['fullstack'] })
      .expect(200);

    expect(body).toMatchObject({ success: true });
  });
});

describe('POST /public/v1/feeds/filters/sources/follow', () => {
  it('should follow sources globally', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .post('/public/v1/feeds/filters/sources/follow')
      .set('Authorization', `Bearer ${token}`)
      .send({ sources: ['a'] })
      .expect(200);

    expect(body).toMatchObject({ success: true });
  });
});

describe('POST /public/v1/feeds/filters/sources/unfollow', () => {
  it('should unfollow sources globally', async () => {
    const token = await createTokenForUser(state.con, '5');

    // First follow a source to ensure the feed exists
    await request(state.app.server)
      .post('/public/v1/feeds/filters/sources/follow')
      .set('Authorization', `Bearer ${token}`)
      .send({ sources: ['a'] })
      .expect(200);

    // Now unfollow
    const { body } = await request(state.app.server)
      .post('/public/v1/feeds/filters/sources/unfollow')
      .set('Authorization', `Bearer ${token}`)
      .send({ sources: ['a'] })
      .expect(200);

    expect(body).toMatchObject({ success: true });
  });
});

describe('POST /public/v1/feeds/filters/sources/block', () => {
  it('should block sources globally', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .post('/public/v1/feeds/filters/sources/block')
      .set('Authorization', `Bearer ${token}`)
      .send({ sources: ['b'] })
      .expect(200);

    expect(body).toMatchObject({ success: true });
  });
});

describe('POST /public/v1/feeds/filters/sources/unblock', () => {
  it('should unblock sources globally', async () => {
    const token = await createTokenForUser(state.con, '5');

    // First block a source to ensure the feed exists
    await request(state.app.server)
      .post('/public/v1/feeds/filters/sources/block')
      .set('Authorization', `Bearer ${token}`)
      .send({ sources: ['b'] })
      .expect(200);

    // Now unblock
    const { body } = await request(state.app.server)
      .post('/public/v1/feeds/filters/sources/unblock')
      .set('Authorization', `Bearer ${token}`)
      .send({ sources: ['b'] })
      .expect(200);

    expect(body).toMatchObject({ success: true });
  });
});

describe('Custom feed filters (/public/v1/feeds/filters/:feedId)', () => {
  it('should get custom feed filter settings', async () => {
    const token = await createTokenForUser(state.con, '5');

    // Create a feed first
    const { body: createBody } = await request(state.app.server)
      .post('/public/v1/feeds/custom')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Filter Test Feed' })
      .expect(200);

    const { body } = await request(state.app.server)
      .get(`/public/v1/feeds/filters/${createBody.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body).toMatchObject({
      includeTags: expect.any(Array),
      blockedTags: expect.any(Array),
    });
  });

  it('should follow tags for custom feed', async () => {
    const token = await createTokenForUser(state.con, '5');

    // Create a feed first
    const { body: createBody } = await request(state.app.server)
      .post('/public/v1/feeds/custom')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Tag Follow Test Feed' })
      .expect(200);

    const { body } = await request(state.app.server)
      .post(`/public/v1/feeds/filters/${createBody.id}/tags/follow`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tags: ['webdev', 'rust'] })
      .expect(200);

    expect(body).toMatchObject({ success: true });
  });

  it('should block sources for custom feed', async () => {
    const token = await createTokenForUser(state.con, '5');

    // Create a feed first
    const { body: createBody } = await request(state.app.server)
      .post('/public/v1/feeds/custom')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Source Block Test Feed' })
      .expect(200);

    const { body } = await request(state.app.server)
      .post(`/public/v1/feeds/filters/${createBody.id}/sources/block`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sources: ['a'] })
      .expect(200);

    expect(body).toMatchObject({ success: true });
  });
});
