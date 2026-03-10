import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { saveFixtures } from '../helpers';
import { User } from '../../src/entity/user/User';
import { usersFixture } from '../fixture';
import { ioRedisPool } from '../../src/redis';

let app: FastifyInstance;
let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();

  process.env.BETTER_AUTH_SECRET = 'a]3Bv!k9Pz@mQ7wX#rL2sY&dN5fH8jT-test-only';
  try {
    const { initializeBetterAuth } = await import('../../src/betterAuth');
    initializeBetterAuth();
  } catch {
    // BA initialization may fail in test with mocked module
  }

  const appFunc = (await import('../../src')).default;
  app = await appFunc();
  return app.ready();
});

afterAll(async () => {
  if (app) {
    await app.close();
  }
});

beforeEach(async () => {
  jest.clearAllMocks();
  await ioRedisPool.execute((client) => client.flushall());
  await saveFixtures(con, User, usersFixture);
});

describe('betterAuth routes', () => {
  describe('unauthenticated access', () => {
    it('should return 401 for change-email without session', async () => {
      const res = await request(app.server)
        .post('/a/auth/change-email')
        .send({ newEmail: 'new@example.com' });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Not authenticated');
    });

    it('should return 401 for verify-change-email without session', async () => {
      const res = await request(app.server)
        .post('/a/auth/verify-change-email')
        .send({ code: '123456' });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Not authenticated');
    });

    it('should return 401 for set-password without session', async () => {
      const res = await request(app.server)
        .post('/a/auth/set-password')
        .send({ newPassword: 'newSecurePass123' });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Not authenticated');
    });
  });

  describe('input validation', () => {
    it('should return 400 for check-email without email param', async () => {
      const res = await request(app.server).get('/a/auth/check-email');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'email is required');
    });

    it('should return 400 for social sign-in without provider', async () => {
      const res = await request(app.server).get('/a/auth/sign-in/social');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'provider is required');
    });

    it('should return 400 for social link without provider', async () => {
      const res = await request(app.server).get('/a/auth/link-social');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'provider is required');
    });
  });
});
