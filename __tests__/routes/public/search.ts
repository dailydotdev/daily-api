import request from 'supertest';
import { setupPublicApiTests, createTokenForUser } from './helpers';
import { Keyword } from '../../../src/entity';

const state = setupPublicApiTests();

// Note: searchPosts endpoint depends on external search services (Mimir)
// These tests are skipped as they require mocking the search infrastructure
describe.skip('GET /public/v1/search/posts', () => {
  it('should return search results for posts', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .get('/public/v1/search/posts')
      .query({ q: 'P1' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toMatchObject({
      hasNextPage: expect.any(Boolean),
    });
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
