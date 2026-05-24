import request from 'supertest';
import { setupPublicApiTests, createTokenForUser } from './helpers';

const state = setupPublicApiTests();

describe('Public API Rate Limiting', () => {
  describe('IP-based rate limiting (Layer 1 - DoS protection)', () => {
    it('should not expose IP rate limit headers (transparent DoS protection)', async () => {
      // IP rate limiting runs before auth but headers are hidden
      // Only user rate limit headers are exposed to consumers
      const token = await createTokenForUser(state.con, '5');

      const res = await request(state.app.server)
        .get('/public/v1/feeds/foryou')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // User rate limit headers are shown (60/min)
      expect(res.headers['x-ratelimit-limit']).toBe('60');
      expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    });
  });

  describe('User-based rate limiting (Layer 2 - API quota)', () => {
    it('should include user rate limit headers in response', async () => {
      const token = await createTokenForUser(state.con, '5');

      const res = await request(state.app.server)
        .get('/public/v1/feeds/foryou')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.headers['x-ratelimit-limit']).toBe('60');
      expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    });

    it('should decrement user rate limit with each request', async () => {
      const token = await createTokenForUser(state.con, '5');

      const res1 = await request(state.app.server)
        .get('/public/v1/feeds/foryou')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const remaining1 = parseInt(res1.headers['x-ratelimit-remaining'], 10);

      const res2 = await request(state.app.server)
        .get('/public/v1/feeds/foryou')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const remaining2 = parseInt(res2.headers['x-ratelimit-remaining'], 10);

      expect(remaining2).toBeLessThan(remaining1);
    });

    // Regression: errorResponseBuilder must include statusCode so the global
    // setErrorHandler preserves 429. Without it, exceeding the limit returns
    // a misleading 500.
    it('should return 429 (not 500) when user rate limit is exceeded', async () => {
      const token = await createTokenForUser(state.con, '5');

      // Fire 61 requests in a row — limit is 60/min/user.
      let lastRes;
      for (let i = 0; i < 61; i++) {
        lastRes = await request(state.app.server)
          .get('/public/v1/feeds/foryou')
          .set('Authorization', `Bearer ${token}`);
        if (lastRes.status === 429) break;
      }

      expect(lastRes!.status).toBe(429);
      expect(lastRes!.body).toMatchObject({
        statusCode: 429,
        error: 'rate_limit_exceeded',
        message: expect.stringContaining('rate limit'),
      });
    });
  });
});
