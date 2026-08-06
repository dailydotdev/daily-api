import request from 'supertest';
import { setupPublicApiTests } from './helpers';

const state = setupPublicApiTests();

const AGENT_UA = 'ClaudeBot/1.0 (+https://anthropic.com/claude-bot)';

const spyOnSignupLog = () =>
  jest.spyOn(state.app.log, 'info').mockImplementation(() => undefined);

const findSignupLog = (spy: jest.SpyInstance) =>
  spy.mock.calls.find(
    ([payload]) =>
      typeof payload === 'object' &&
      payload !== null &&
      (payload as { event?: string }).event === 'agent_signup_attempt',
  )?.[0] as Record<string, unknown> | undefined;

describe('POST /public/v1/signup', () => {
  it('should answer 501 without a token and point at the human flow', async () => {
    const { body } = await request(state.app.server)
      .post('/public/v1/signup')
      .send({ email: 'agent@example.com', password: 'correct-horse' })
      .expect(501);

    expect(body).toMatchObject({
      error: 'not_implemented',
      signupUrl: 'https://app.daily.dev/onboarding',
      tokenUrl: 'https://app.daily.dev/settings/api',
      message: expect.stringContaining('not available yet'),
    });
  });

  it('should log the attempt with the user agent but never the password', async () => {
    const spy = spyOnSignupLog();

    await request(state.app.server)
      .post('/public/v1/signup')
      .set('User-Agent', AGENT_UA)
      .send({ email: 'agent@example.com', password: 'correct-horse' })
      .expect(501);

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
      .expect(501);

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
      .expect(501);

    expect(body.error).toBe('not_implemented');
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
      .expect(501);

    await request(state.app.server)
      .post('/public/v1/signup?ref=llms.txt')
      .send({ email: 'agent@example.com', password: 'correct-horse' })
      .expect(501);
  });

  it('should still require a token on every other public route', async () => {
    const { body } = await request(state.app.server)
      .get('/public/v1/feeds/foryou')
      .expect(401);

    expect(body.error).toBe('unauthorized');
  });
});
