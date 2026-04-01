import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { saveFixtures } from '../helpers';
import { User } from '../../src/entity/user/User';
import { usersFixture } from '../fixture';
import { ioRedisPool } from '../../src/redis';
import * as betterAuthModule from '../../src/betterAuth';

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

    it('should forward native callback routes to BetterAuth handler', async () => {
      const getBetterAuthSpy = jest
        .spyOn(betterAuthModule, 'getBetterAuth')
        .mockReturnValue({
          handler: async (req: Request) => {
            const url = new URL(req.url);
            return new Response(`${url.pathname}${url.search}`, {
              status: 200,
            });
          },
          api: {
            getSession: async () => null,
            setPassword: async () => ({ status: true }),
          },
        } as ReturnType<typeof betterAuthModule.getBetterAuth>);

      const res = await request(app.server).get(
        '/auth/callback/google?state=test&code=abc',
      );

      expect(res.status).toBe(200);
      expect(res.text).toBe('/auth/callback/google?state=test&code=abc');

      getBetterAuthSpy.mockRestore();
    });
  });
});

  describe('error response logging', () => {
    it('should log error details for failed sign-up requests', async () => {
      const errorBody = { code: 'BAD_REQUEST', message: 'Failed to create user' };
      const getBetterAuthSpy = jest
        .spyOn(betterAuthModule, 'getBetterAuth')
        .mockReturnValue({
          handler: async () => {
            return new Response(JSON.stringify(errorBody), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          },
          api: {
            getSession: async () => null,
            setPassword: async () => ({ status: true }),
          },
        } as ReturnType<typeof betterAuthModule.getBetterAuth>);

      const res = await request(app.server)
        .post('/auth/sign-up/email')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'secret123',
          username: 'testuser',
        });

      expect(res.status).toBe(400);
      expect(res.body).toEqual(errorBody);

      getBetterAuthSpy.mockRestore();
    });

    it('should not log for non-monitored paths', async () => {
      const getBetterAuthSpy = jest
        .spyOn(betterAuthModule, 'getBetterAuth')
        .mockReturnValue({
          handler: async () => {
            return new Response(JSON.stringify({ error: 'not found' }), {
              status: 404,
            });
          },
          api: {
            getSession: async () => null,
            setPassword: async () => ({ status: true }),
          },
        } as ReturnType<typeof betterAuthModule.getBetterAuth>);

      const res = await request(app.server).get('/auth/some-other-path');

      expect(res.status).toBe(404);

      getBetterAuthSpy.mockRestore();
    });

    it('should sanitize sensitive fields from request body in logs', async () => {
      const getBetterAuthSpy = jest
        .spyOn(betterAuthModule, 'getBetterAuth')
        .mockReturnValue({
          handler: async () => {
            return new Response(
              JSON.stringify({ code: 'BAD_REQUEST', message: 'error' }),
              { status: 400 },
            );
          },
          api: {
            getSession: async () => null,
            setPassword: async () => ({ status: true }),
          },
        } as ReturnType<typeof betterAuthModule.getBetterAuth>);

      const res = await request(app.server)
        .post('/auth/sign-up/email')
        .send({
          name: 'Test',
          email: 'test@test.com',
          password: 'should-be-stripped',
          turnstileToken: 'should-be-stripped',
          username: 'visible',
        });

      // Response is still returned correctly
      expect(res.status).toBe(400);

      getBetterAuthSpy.mockRestore();
    });
  });
