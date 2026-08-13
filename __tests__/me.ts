import type { FastifyInstance } from 'fastify';
import request from 'supertest';
import { signJwt } from '../src/auth';
import * as betterAuthModule from '../src/betterAuth';
import type { BetterAuthHandler } from '../src/betterAuth';
import { cookies } from '../src/cookies';
import createOrGetConnection from '../src/db';
import {
  disposeGraphQLTesting,
  initializeGraphQLTesting,
  type GraphQLTestingState,
  MockContext,
} from './helpers';

let app: FastifyInstance;
let state: GraphQLTestingState;

beforeAll(async () => {
  const con = await createOrGetConnection();
  state = await initializeGraphQLTesting(() => new MockContext(con));
  app = state.app;
});

afterAll(() => disposeGraphQLTesting(state));

beforeEach(() => {
  jest.restoreAllMocks();
});

const expectPrivateRedirect = (res: request.Response): void => {
  expect(res.headers).toMatchObject({
    'cache-control': 'private, no-store',
    vary: expect.stringContaining('Cookie'),
  });
};

describe('GET /me', () => {
  it('redirects a legacy JWT session to the user id profile', async () => {
    const accessToken = await signJwt({ userId: '1', roles: [] });
    const authCookie = app.signCookie(accessToken.token);

    const res = await request(app.server)
      .get('/me')
      .set('Cookie', `${cookies.auth.key}=${authCookie}`)
      .expect(302);

    expect(res.headers.location).toBe('http://localhost:5002/1');
    expectPrivateRedirect(res);
  });

  it('redirects a Better Auth session to the user id profile', async () => {
    const auth = {
      handler: jest.fn(),
      api: {
        getSession: jest.fn().mockResolvedValue({
          user: {
            id: '1',
            name: 'Test User',
            email: 'test@example.com',
            emailVerified: true,
          },
          session: {
            id: 'session-id',
            userId: '1',
            expiresAt: new Date(),
            token: 'session-token',
          },
        }),
        setPassword: jest.fn(),
      },
    } satisfies BetterAuthHandler;
    jest.spyOn(betterAuthModule, 'getBetterAuth').mockReturnValue(auth);

    const res = await request(app.server)
      .get('/me')
      .set('Cookie', `${cookies.authSession.key}=session-token`)
      .expect(302);

    expect(auth.api.getSession).toHaveBeenCalledTimes(1);
    expect(res.headers.location).toBe('http://localhost:5002/1');
    expectPrivateRedirect(res);
  });

  it('redirects anonymous users to the homepage', async () => {
    const res = await request(app.server).get('/me').expect(302);

    expect(res.headers.location).toBe('http://localhost:5002/');
    expectPrivateRedirect(res);
  });
});
