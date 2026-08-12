import jwt from 'jsonwebtoken';
import request from 'supertest';
import {
  MARKDOWN_TOKEN_AUDIENCE,
  MARKDOWN_TOKEN_ISSUER,
  MARKDOWN_TOKEN_PREFIX,
  MARKDOWN_TOKEN_SCOPE,
} from '../../src/common/agentRegistration';
import { setupPublicApiTests } from './public/helpers';

const TOKEN_SECRET = 'agent-markdown-token-test-secret';
process.env.AGENT_ACCESS_TOKEN_SECRET = TOKEN_SECRET;

const state = setupPublicApiTests();

describe('agent signup', () => {
  it('issues a markdown-only token and human signup URL', async () => {
    const { body } = await request(state.app.server)
      .post('/agents/v1/signup')
      .send({})
      .expect(201);

    expect(body).toMatchObject({
      token: expect.stringMatching(/^ddm_/),
      signupUrl: expect.any(String),
      expiresAt: expect.any(String),
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
