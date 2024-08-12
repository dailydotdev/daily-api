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
import { SlackEvent } from '../../src/common';
import {
  AnalyticsEventName,
  sendAnalyticsEvent,
} from '../../src/integrations/analytics';

jest.mock('../../src/integrations/analytics', () => ({
  ...(jest.requireActual('../../src/integrations/analytics') as Record<
    string,
    unknown
  >),
  sendAnalyticsEvent: jest.fn(),
}));

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
    expect(sendAnalyticsEvent).toHaveBeenCalledTimes(1);
    expect(sendAnalyticsEvent).toHaveBeenCalledWith([
      {
        event_name: AnalyticsEventName.ConfirmAddingWorkspace,
        user_id: '1',
        app_platform: 'api',
        event_timestamp: expect.any(Date),
        target_id: UserIntegrationType.Slack,
      },
    ]);
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
    expect(sendAnalyticsEvent).toHaveBeenCalledTimes(1);
    expect(sendAnalyticsEvent).toHaveBeenCalledWith([
      {
        event_name: AnalyticsEventName.ConfirmAddingWorkspace,
        user_id: '1',
        app_platform: 'api',
        event_timestamp: expect.any(Date),
        target_id: UserIntegrationType.Slack,
      },
    ]);
  });
});

describe('POST /integrations/slack/events', () => {
  it('should return 403 when signature is missing', async () => {
    const { body } = await request(app.server)
      .post('/integrations/slack/events')
      .send({
        token: 'test',
        challenge: 'test',
        type: 'url_verification',
      })
      .expect(403);

    expect(body).toEqual({ challenge: 'invalid signature' });
  });

  it('should return 403 when signature timestamp is missing', async () => {
    const { body } = await request(app.server)
      .post('/integrations/slack/events')
      .send({
        token: 'test',
        challenge: 'test',
        type: 'url_verification',
      })
      .set('x-slack-signature', '123')
      .expect(403);

    expect(body).toEqual({ challenge: 'invalid signature' });
  });

  it('should return 200 when signature is valid', async () => {
    const { body } = await request(app.server)
      .post('/integrations/slack/events')
      .set('x-slack-request-timestamp', '1722461509')
      .set(
        'x-slack-signature',
        'v0=35acd12ea5181014743dc78eeb8cdb432fd1c23d9925e3ab1f13d259b991901e',
      )
      .send({
        token: 'test',
        challenge: 'test',
        type: 'url_verification',
      })
      .expect(200);

    expect(body).toEqual({ challenge: 'test' });
  });

  it('should remove user integration on app uninstall event', async () => {
    await con.getRepository(UserIntegration).save([
      {
        userId: '1',
        type: UserIntegrationType.Slack,
        meta: {
          teamId: 't1',
        },
      },
      {
        userId: '2',
        type: UserIntegrationType.Slack,
        meta: {
          teamId: 't1',
        },
      },
    ]);
    const teamIntegrationsQuery = con
      .getRepository(UserIntegration)
      .createQueryBuilder()
      .where("meta->>'teamId' = :teamId", { teamId: 't1' });

    expect(await teamIntegrationsQuery.getCount()).toBe(2);

    const { body } = await request(app.server)
      .post('/integrations/slack/events')
      .set('x-slack-request-timestamp', '1722461509')
      .send({
        token: 'test',
        team_id: 't1',
        api_app_id: 'test',
        event: {
          type: SlackEvent.AppUninstalled,
          event_ts: '1722459754.211072',
        },
        type: 'event_callback',
        event_id: 'Ev07EJHQ0W6T',
        event_time: 1722459754,
      })
      .expect(200);

    expect(body).toEqual({ success: true });
    expect(await teamIntegrationsQuery.getCount()).toBe(0);
  });

  it('should remove user integration on tokens revoked event', async () => {
    await con.getRepository(UserIntegration).save([
      {
        userId: '1',
        type: UserIntegrationType.Slack,
        meta: {
          teamId: 't1',
        },
      },
      {
        userId: '2',
        type: UserIntegrationType.Slack,
        meta: {
          teamId: 't1',
        },
      },
    ]);
    const teamIntegrationsQuery = con
      .getRepository(UserIntegration)
      .createQueryBuilder()
      .where("meta->>'teamId' = :teamId", { teamId: 't1' });

    expect(await teamIntegrationsQuery.getCount()).toBe(2);

    const { body } = await request(app.server)
      .post('/integrations/slack/events')
      .set('x-slack-request-timestamp', '1722461509')
      .send({
        token: 'test',
        team_id: 't1',
        api_app_id: 'test',
        event: {
          type: SlackEvent.TokensRevoked,
          event_ts: '1722459754.211072',
        },
        type: 'event_callback',
        event_id: 'Ev07EJHQ0W6T',
        event_time: 1722459754,
      })
      .expect(200);

    expect(body).toEqual({ success: true });
    expect(await teamIntegrationsQuery.getCount()).toBe(0);
  });

  it('should not remove user integration on unknown event', async () => {
    await con.getRepository(UserIntegration).save([
      {
        userId: '1',
        type: UserIntegrationType.Slack,
        meta: {
          teamId: 't1',
        },
      },
      {
        userId: '2',
        type: UserIntegrationType.Slack,
        meta: {
          teamId: 't1',
        },
      },
    ]);
    const teamIntegrationsQuery = con
      .getRepository(UserIntegration)
      .createQueryBuilder()
      .where("meta->>'teamId' = :teamId", { teamId: 't1' });

    expect(await teamIntegrationsQuery.getCount()).toBe(2);

    const { body } = await request(app.server)
      .post('/integrations/slack/events')
      .set('x-slack-request-timestamp', '1722461509')
      .send({
        token: 'test',
        team_id: 't1',
        api_app_id: 'test',
        event: {
          type: 'unknown',
          event_ts: '1722459754.211072',
        },
        type: 'event_callback',
        event_id: 'Ev07EJHQ0W6T',
        event_time: 1722459754,
      })
      .expect(200);

    expect(body).toEqual({ success: true });
    expect(await teamIntegrationsQuery.getCount()).toBe(2);
  });

  it('should remove user integration for other teams', async () => {
    await con.getRepository(UserIntegration).save([
      {
        userId: '1',
        type: UserIntegrationType.Slack,
        meta: {
          teamId: 't1',
        },
      },
      {
        userId: '2',
        type: UserIntegrationType.Slack,
        meta: {
          teamId: 't2',
        },
      },
    ]);
    const teamIntegrationsQuery = con
      .getRepository(UserIntegration)
      .createQueryBuilder();

    expect(await teamIntegrationsQuery.getCount()).toBe(2);

    const { body } = await request(app.server)
      .post('/integrations/slack/events')
      .set('x-slack-request-timestamp', '1722461509')
      .send({
        token: 'test',
        team_id: 't1',
        api_app_id: 'test',
        event: {
          type: SlackEvent.TokensRevoked,
          event_ts: '1722459754.211072',
        },
        type: 'event_callback',
        event_id: 'Ev07EJHQ0W6T',
        event_time: 1722459754,
      })
      .expect(200);

    expect(body).toEqual({ success: true });
    expect(await teamIntegrationsQuery.getCount()).toBe(1);
  });
});
