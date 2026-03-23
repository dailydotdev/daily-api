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
  describe('native Better Auth routes', () => {
    it('should return 200 for the health endpoint', async () => {
      const res = await request(app.server).get('/auth/ok');

      expect(res.status).toBe(200);
    });

    it('should keep OAuth state in the database with a 10 minute state cookie', async () => {
      const { getBetterAuthOptions } = await import('../../src/betterAuth');
      const options = getBetterAuthOptions(
        (con.driver as unknown as { master: never }).master,
      );

      expect(options.advanced?.cookies?.state).toMatchObject({
        attributes: {
          maxAge: 10 * 60,
        },
      });
      expect(options.account).toMatchObject({
        modelName: 'ba_account',
      });
    });
  });
});
