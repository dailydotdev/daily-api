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
  });
});
