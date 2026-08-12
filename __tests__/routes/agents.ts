import jwt from 'jsonwebtoken';
import request from 'supertest';
import { sendAnalyticsEvent } from '../../src/integrations/analytics';
import {
  generateAgentMarkdownToken,
  MARKDOWN_TOKEN_AUDIENCE,
  MARKDOWN_TOKEN_ISSUER,
  MARKDOWN_TOKEN_PREFIX,
  MARKDOWN_TOKEN_SCOPE,
} from '../../src/common/agentRegistration';
import { setupPublicApiTests } from './public/helpers';

jest.mock('../../src/integrations/analytics', () => ({
  ...(jest.requireActual('../../src/integrations/analytics') as Record<
    string,
    unknown
  >),
  sendAnalyticsEvent: jest.fn(),
}));

const TOKEN_SECRET = 'agent-markdown-token-test-secret';
process.env.AGENT_ACCESS_TOKEN_SECRET = TOKEN_SECRET;

const state = setupPublicApiTests();

describe('agent signup', () => {
  it('issues a markdown-only token and human signup URL', async () => {
    const { body } = await request(state.app.server)
      .post('/agents/v1/signup')
      .set('user-agent', 'test-agent')
      .set('referer', 'https://daily.dev/posts/example.md')
      .send({})
      .expect(201);

    expect(body).toMatchObject({
      token: expect.stringMatching(/^ddm_/),
      signupUrl: expect.any(String),
      expiresAt: expect.any(String),
      instructions: expect.stringMatching(/^This token is provisional:/),
    });
    const signupUrl = new URL(body.signupUrl);
    expect(signupUrl.origin).toBe(new URL(process.env.COMMENTS_PREFIX).origin);
    expect(signupUrl.pathname).toBe('/onboarding');
    expect(signupUrl.searchParams.get('agent_token')).toBe(body.token);

    const payload = jwt.verify(
      body.token.slice(MARKDOWN_TOKEN_PREFIX.length),
      TOKEN_SECRET,
      {
        algorithms: ['HS256'],
        audience: MARKDOWN_TOKEN_AUDIENCE,
        issuer: MARKDOWN_TOKEN_ISSUER,
      },
    ) as jwt.JwtPayload;
    expect(payload.aud).toBe(MARKDOWN_TOKEN_AUDIENCE);
    expect(payload.iss).toBe(MARKDOWN_TOKEN_ISSUER);
    expect(payload.scope).toBe(MARKDOWN_TOKEN_SCOPE);
    expect(payload.exp).toEqual(expect.any(Number));
    expect(payload.sub).toEqual(expect.any(String));
    expect(payload.jti).toEqual(expect.any(String));
    expect(payload.exp! - payload.iat!).toBe(60 * 60);
    expect(new Date(body.expiresAt).getTime()).toBe(payload.exp! * 1000);

    expect(sendAnalyticsEvent).toHaveBeenCalledWith([
      expect.objectContaining({
        event_name: 'agent signup',
        event_page: '/agents/v1/signup',
        app_platform: 'api',
        user_agent: 'test-agent',
        user_id: expect.any(String),
      }),
    ]);
  });

  it('answers GET discovery with signup instructions', async () => {
    const { body } = await request(state.app.server)
      .get('/agents/v1/signup')
      .expect(200);

    expect(body).toMatchObject({
      token: expect.stringMatching(/^ddm_/),
      signupUrl: expect.any(String),
      expiresAt: expect.any(String),
      instructions: expect.stringMatching(/^This token is provisional:/),
    });
  });

  it('requires an access-token secret of at least 32 bytes', () => {
    const secret = process.env.AGENT_ACCESS_TOKEN_SECRET;
    process.env.AGENT_ACCESS_TOKEN_SECRET = 'too-short';

    try {
      expect(generateAgentMarkdownToken).toThrow(
        'AGENT_ACCESS_TOKEN_SECRET must be configured with at least 32 bytes',
      );
    } finally {
      process.env.AGENT_ACCESS_TOKEN_SECRET = secret;
    }
  });

  it('does not accept the markdown token as Public API authentication', async () => {
    const signup = await request(state.app.server)
      .post('/agents/v1/signup')
      .send({})
      .expect(201);

    await request(state.app.server)
      .get('/public/v1/feeds/foryou')
      .set('authorization', `Bearer ${signup.body.token}`)
      .expect(401);
  });
});
