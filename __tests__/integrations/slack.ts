import appFunc from '../../src';
import { FastifyInstance } from 'fastify';
import { authorizeRequest, saveFixtures } from '../helpers';
import { User } from '../../src/entity';
import { usersFixture } from '../fixture';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import request from 'supertest';
import nock from 'nock';
import {
  UserIntegration,
  UserIntegrationType,
} from '../../src/entity/UserIntegration';

let app: FastifyInstance;
let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
  app = await appFunc();
  return app.ready();
});

afterAll(() => app.close());

beforeEach(async () => {
  nock.cleanAll();
  jest.resetAllMocks();
  await saveFixtures(con, User, usersFixture);
});

describe('GET /integrations/slack/auth/callback', () => {
  it('should return 401 when user is not authenticated', async () => {
    const { body, headers } = await request(app.server)
      .get('/integrations/slack/auth/callback')
      .send({})
      .expect(307);

    expect(body).toEqual({});
    expect(headers.location).toBe('http://localhost:5002/?error=unauthorized');
  });

  it('should error when state is invalid', async () => {
    const { body, headers } = await authorizeRequest(
      request(app.server)
        .get('/integrations/slack/auth/callback?state=invalid')
        .set('Cookie', 'slackRedirectPath=/squads/test'),
    ).expect(307);

    expect(body).toEqual({});
    expect(headers.location).toBe(
      'http://localhost:5002/squads/test?error=invalid+state',
    );
  });

  it('should redirect to path if cookie is set', async () => {
    const { body, headers } = await authorizeRequest(
      request(app.server).get(
        '/integrations/slack/auth/callback?state=invalid',
      ),
    ).expect(307);

    expect(body).toEqual({});
    expect(headers.location).toBe('http://localhost:5002/?error=invalid+state');
  });

  it('should error when code is missing', async () => {
    const { body, headers } = await authorizeRequest(
      request(app.server).get('/integrations/slack/auth/callback?state=1'),
    ).expect(307);

    expect(body).toEqual({});
    expect(headers.location).toBe('http://localhost:5002/?error=missing+code');
  });

  it('should error when error is passed', async () => {
    const { body, headers } = await authorizeRequest(
      request(app.server).get(
        '/integrations/slack/auth/callback?state=1&error=invalid_scope',
      ),
    ).expect(307);

    expect(body).toEqual({});
    expect(headers.location).toBe('http://localhost:5002/?error=invalid_scope');
  });

  it('should error when token request returns non 2xx status', async () => {
    nock('https://slack.com').post('/api/oauth.v2.access').reply(400, {
      error: 'invalid token',
    });

    const { body, headers } = await authorizeRequest(
      request(app.server).get(
        '/integrations/slack/auth/callback?state=1&code=123',
      ),
    ).expect(307);

    expect(body).toEqual({});
    expect(headers.location).toBe(
      'http://localhost:5002/?error=failed+to+get+slack+token',
    );
  });

  it('should error when token request fails', async () => {
    nock('https://slack.com').post('/api/oauth.v2.access').reply(200, {
      ok: false,
      error: 'code expired',
    });

    const { body, headers } = await authorizeRequest(
      request(app.server).get(
        '/integrations/slack/auth/callback?state=1&code=123',
      ),
    ).expect(307);

    expect(body).toEqual({});
    expect(headers.location).toBe('http://localhost:5002/?error=code+expired');
  });

  it('should create integration', async () => {
    nock('https://slack.com')
      .post('/api/oauth.v2.access')
      .reply(200, {
        ok: true,
        app_id: 'sapp1',
        authed_user: { id: 'su1' },
        scope: 'channels:read,chat:write,channels:join',
        token_type: 'bot',
        access_token: 'xoxb-token',
        team: { id: 'st1', name: 'daily.dev' },
      });

    const { body, headers } = await authorizeRequest(
      request(app.server)
        .get('/integrations/slack/auth/callback?state=1&code=123')
        .set('Cookie', 'slackRedirectPath=/squads/test'),
    ).expect(307);

    expect(body).toEqual({});
    expect(headers.location).toBe('http://localhost:5002/squads/test');

    const integration = await con
      .getRepository(UserIntegration)
      .findOneByOrFail({
        userId: '1',
        type: UserIntegrationType.Slack,
      });
    expect(integration).toMatchObject({
      userId: '1',
      type: UserIntegrationType.Slack,
      meta: {
        appId: 'sapp1',
        scope: 'channels:read,chat:write,channels:join',
        teamId: 'st1',
        teamName: 'daily.dev',
        tokenType: 'bot',
        accessToken: expect.stringMatching(/^.*==:.*==$/),
        slackUserId: 'su1',
      },
    });
  });

  it('should update integration if it already exists', async () => {
    await con.getRepository(UserIntegration).save([
      {
        userId: '1',
        type: UserIntegrationType.Slack,
        meta: {
          appId: 'sapp1',
          scope: 'channels:read,chat:write,channels:join',
          teamId: 'st1',
          teamName: 'daily.dev',
          tokenType: 'bot',
          accessToken: expect.stringMatching(/^.*==:.*==$/),
          slackUserId: 'su1',
        },
      },
    ]);

    nock('https://slack.com')
      .post('/api/oauth.v2.access')
      .reply(200, {
        ok: true,
        app_id: 'sapp1',
        authed_user: { id: 'su1' },
        scope: 'channels:read,chat:write,channels:join,channels:more',
        token_type: 'bot',
        access_token: 'xoxb-token',
        team: { id: 'st1', name: 'daily.dev updated' },
      });

    const { body, headers } = await authorizeRequest(
      request(app.server)
        .get('/integrations/slack/auth/callback?state=1&code=123')
        .set('Cookie', 'slackRedirectPath=/squads/test'),
    ).expect(307);

    expect(body).toEqual({});
    expect(headers.location).toBe('http://localhost:5002/squads/test');

    const integration = await con
      .getRepository(UserIntegration)
      .findOneByOrFail({
        userId: '1',
        type: UserIntegrationType.Slack,
      });
    expect(integration).toMatchObject({
      userId: '1',
      type: UserIntegrationType.Slack,
      meta: {
        appId: 'sapp1',
        scope: 'channels:read,chat:write,channels:join,channels:more',
        teamId: 'st1',
        teamName: 'daily.dev updated',
        tokenType: 'bot',
        accessToken: expect.stringMatching(/^.*==:.*==$/),
        slackUserId: 'su1',
      },
    });
  });
});
