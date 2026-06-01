import appFunc from '../src';
import { FastifyInstance } from 'fastify';
import request from 'supertest';

let app: FastifyInstance;

beforeAll(async () => {
  app = await appFunc();
  return app.ready();
});

afterAll(() => app.close());

beforeEach(() => {
  jest.resetAllMocks();
  process.env.EMAIL_TRACKING_ORIGIN = 'https://t.daily.dev';
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
});

describe('GET /em/t', () => {
  it('should redirect to the webapp with the relative path', async () => {
    await request(app.server)
      .get('/em/t/c?r=/posts/p1')
      .expect(307)
      .expect('Location', 'http://localhost:5002/posts/p1');

    expect(fetch).not.toHaveBeenCalled();
  });

  it('should attribute the click to customer.io when link_id is present', async () => {
    await request(app.server)
      .get('/em/t/c?r=/posts/p1&link_id=token%2B123')
      .expect(307)
      .expect('Location', 'http://localhost:5002/posts/p1');

    expect(fetch).toHaveBeenCalledWith(
      'https://t.daily.dev/click/token%2B123',
      { method: 'POST' },
    );
  });

  it('should fall back to the webapp root for non-relative targets', async () => {
    for (const r of ['https://evil.com', '//evil.com', '/\\evil.com']) {
      await request(app.server)
        .get(`/em/t/c?r=${encodeURIComponent(r)}`)
        .expect(307)
        .expect('Location', 'http://localhost:5002/');
    }
  });

  it('should redirect to the webapp root when no target is provided', async () => {
    await request(app.server)
      .get('/em/t/c')
      .expect(307)
      .expect('Location', 'http://localhost:5002/');
  });

  it('should return 500 when link_id is present but the tracking origin is not configured', async () => {
    delete process.env.EMAIL_TRACKING_ORIGIN;

    await request(app.server)
      .get('/em/t/c?r=/posts/p1&link_id=token123')
      .expect(500);

    expect(fetch).not.toHaveBeenCalled();
  });
});
