import request from 'supertest';
import { setupPublicApiTests, createTokenForUser } from './helpers';

const state = setupPublicApiTests();

describe('Public API Rate Limiting', () => {
  it('should include rate limit headers in response', async () => {
    const token = await createTokenForUser(state.con, '5');

    const res = await request(state.app.server)
      .get('/public/v1/feed')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.headers['x-ratelimit-limit']).toBeDefined();
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
  });

  it('should decrement remaining rate limit with each request', async () => {
    const token = await createTokenForUser(state.con, '5');

    const res1 = await request(state.app.server)
      .get('/public/v1/feed')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const remaining1 = parseInt(res1.headers['x-ratelimit-remaining'], 10);

    const res2 = await request(state.app.server)
      .get('/public/v1/feed')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const remaining2 = parseInt(res2.headers['x-ratelimit-remaining'], 10);

    expect(remaining2).toBeLessThan(remaining1);
  });
});
