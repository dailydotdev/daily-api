import request from 'supertest';
import { setupPublicApiTests } from './helpers';
import { logger } from '../../../src/logger';

const state = setupPublicApiTests();

const AGENT_UA = 'ClaudeBot/1.0 (+https://anthropic.com/claude-bot)';

// The route logs through the shared `logger`, not `req.log`: Fastify's
// per-request child does not inherit a spy installed on the app logger,
// so an assertion against `state.app.log` never sees the call.
const spyOnSignupLog = () =>
  jest.spyOn(logger, 'info').mockImplementation(() => undefined);

const findSignupLog = (spy: jest.SpyInstance) =>
  spy.mock.calls.find(
    ([payload]) =>
      typeof payload === 'object' &&
      payload !== null &&
      (payload as { event?: string }).event === 'agent_signup_attempt',
  )?.[0] as Record<string, unknown> | undefined;

describe('POST /public/v1/signup', () => {
  it('should answer 503 without a token and point at the web flow', async () => {
    const { body, headers } = await request(state.app.server)
      .post('/public/v1/signup')
      .send({ email: 'agent@example.com', password: 'correct-horse' })
      .expect(503);

    expect(body).toMatchObject({
      error: 'service_unavailable',
      signupUrl: 'https://app.daily.dev/onboarding',
      tokenUrl: 'https://app.daily.dev/settings/api',
      retryAfter: 3600,
      message: expect.stringContaining('temporarily unavailable'),
    });
    expect(headers['retry-after']).toBe('3600');
  });

  it('should log the attempt with the user agent but never the password', async () => {
    const spy = spyOnSignupLog();

    await request(state.app.server)
      .post('/public/v1/signup')
      .set('User-Agent', AGENT_UA)
      .send({ email: 'agent@example.com', password: 'correct-horse' })
      .expect(503);

    expect(findSignupLog(spy)).toMatchObject({
      event: 'agent_signup_attempt',
      method: 'POST',
      email: 'agent@example.com',
      passwordProvided: true,
      passwordLength: 13,
      bodyKeys: ['email', 'password'],
      userAgent: AGENT_UA,
    });
    expect(JSON.stringify(spy.mock.calls)).not.toContain('correct-horse');
  });

  it('should log and answer 501 for a body that fails validation', async () => {
    const spy = spyOnSignupLog();

    await request(state.app.server)
      .post('/public/v1/signup')
      .send({ email: 'not-an-email' })
      .expect(503);

    expect(findSignupLog(spy)).toMatchObject({
      email: 'not-an-email',
      passwordProvided: false,
      passwordLength: 0,
      validationError: expect.any(String),
    });
  });

  it('should skip auth for a probing GET and log it', async () => {
    const spy = spyOnSignupLog();

    const { body } = await request(state.app.server)
      .get('/public/v1/signup')
      .set('User-Agent', AGENT_UA)
      .expect(503);

    expect(body.error).toBe('service_unavailable');
    expect(findSignupLog(spy)).toMatchObject({
      method: 'GET',
      userAgent: AGENT_UA,
      passwordProvided: false,
    });
  });

  it('should skip auth for the trailing-slash and query-string variants', async () => {
    await request(state.app.server)
      .post('/public/v1/signup/')
      .send({ email: 'agent@example.com', password: 'correct-horse' })
      .expect(503);

    await request(state.app.server)
      .post('/public/v1/signup?ref=llms.txt')
      .send({ email: 'agent@example.com', password: 'correct-horse' })
      .expect(503);
  });

  it('should still require a token on every other public route', async () => {
    const { body } = await request(state.app.server)
      .get('/public/v1/feeds/foryou')
      .expect(401);

    expect(body.error).toBe('unauthorized');
  });
});
