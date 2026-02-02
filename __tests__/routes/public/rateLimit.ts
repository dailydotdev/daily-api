import request from 'supertest';
import { setupPublicApiTests, createTokenForUser } from './helpers';

const state = setupPublicApiTests();

describe('Public API Rate Limiting', () => {
  describe('IP-based rate limiting (Layer 1 - DoS protection)', () => {
    it('should include IP rate limit headers in response', async () => {
      const token = await createTokenForUser(state.con, '5');

      const res = await request(state.app.server)
        .get('/public/v1/feed')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.headers['x-ratelimit-limit']).toBe('300');
      expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    });

    it('should decrement IP rate limit with each request', async () => {
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

  describe('User-based rate limiting (Layer 2 - API quota)', () => {
    it('should include user rate limit headers in response', async () => {
      const token = await createTokenForUser(state.con, '5');

      const res = await request(state.app.server)
        .get('/public/v1/feed')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.headers['x-ratelimit-limit-user']).toBe('60');
      expect(res.headers['x-ratelimit-remaining-user']).toBeDefined();
    });

    it('should decrement user rate limit with each request', async () => {
      const token = await createTokenForUser(state.con, '5');

      const res1 = await request(state.app.server)
        .get('/public/v1/feed')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const remaining1 = parseInt(
        res1.headers['x-ratelimit-remaining-user'],
        10,
      );

      const res2 = await request(state.app.server)
        .get('/public/v1/feed')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const remaining2 = parseInt(
        res2.headers['x-ratelimit-remaining-user'],
        10,
      );

      expect(remaining2).toBeLessThan(remaining1);
    });
  });
});
