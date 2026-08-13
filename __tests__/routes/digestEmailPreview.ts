import fastify, { FastifyInstance } from 'fastify';
import request from 'supertest';
import CIORequest from 'customerio-node/dist/lib/request';
import { retryFetch } from '../../src/integrations/retry';
import digestEmailPreview, {
  prepareDigestEmailHtml,
} from '../../src/routes/digestEmailPreview';

jest.mock('customerio-node/dist/lib/request');
jest.mock('../../src/integrations/retry', () => ({
  retryFetch: jest.fn(),
}));

const mockGetArchivedMessage = jest.fn();
const mockCIORequest = CIORequest as jest.MockedClass<typeof CIORequest>;
const mockRetryFetch = retryFetch as jest.MockedFunction<typeof retryFetch>;

let app: FastifyInstance;
const originalDigestSecret = process.env.PERSONALIZED_DIGEST_SECRET;
const originalCioAppKey = process.env.CIO_APP_KEY;
const originalScraperUrl = process.env.SCRAPER_URL;

beforeAll(async () => {
  app = fastify();
  await app.register(digestEmailPreview, { prefix: '/digest/email-preview' });
  await app.ready();
});

afterAll(async () => {
  if (typeof originalDigestSecret === 'undefined') {
    delete process.env.PERSONALIZED_DIGEST_SECRET;
  } else {
    process.env.PERSONALIZED_DIGEST_SECRET = originalDigestSecret;
  }
  if (typeof originalCioAppKey === 'undefined') {
    delete process.env.CIO_APP_KEY;
  } else {
    process.env.CIO_APP_KEY = originalCioAppKey;
  }
  if (typeof originalScraperUrl === 'undefined') {
    delete process.env.SCRAPER_URL;
  } else {
    process.env.SCRAPER_URL = originalScraperUrl;
  }
  await app.close();
});

beforeEach(() => {
  jest.resetAllMocks();
  process.env.PERSONALIZED_DIGEST_SECRET = 'digest-secret';
  process.env.CIO_APP_KEY = 'cio-key';
  process.env.SCRAPER_URL = 'http://scraper';
  mockCIORequest.mockImplementation(
    () =>
      ({
        get: mockGetArchivedMessage,
      }) as unknown as CIORequest,
  );
});

describe('POST /digest/email-preview', () => {
  it('requires the digest service credential', async () => {
    await request(app.server)
      .post('/digest/email-preview')
      .send({ deliveryId: 'delivery-id' })
      .expect(401, { message: 'unauthorized' });

    expect(mockGetArchivedMessage).not.toHaveBeenCalled();
  });

  it('renders an archived message without its tracking pixel', async () => {
    mockGetArchivedMessage.mockResolvedValue({
      body: `
        <body>
          <img src="https://images.test/creative.png" width="600" height="200">
          <img src="https://track.test/open" width="1" height="1">
        </body>
      `,
    });
    mockRetryFetch.mockResolvedValue({
      buffer: jest.fn().mockResolvedValue(Buffer.from('png')),
    } as never);

    const response = await request(app.server)
      .post('/digest/email-preview')
      .set('authorization', 'Bearer digest-secret')
      .send({ deliveryId: 'delivery-id' })
      .expect(200);

    expect(response.headers).toMatchObject({
      'content-type': 'image/png',
      'cache-control': 'private, no-store',
      pragma: 'no-cache',
    });
    expect(mockRetryFetch).toHaveBeenCalledWith(
      'http://scraper/screenshot',
      expect.objectContaining({
        method: 'POST',
        body: expect.not.stringContaining('https://track.test/open'),
      }),
      { retries: 1 },
    );
  });
});

describe('prepareDigestEmailHtml', () => {
  it('removes tracking pixels and executable embeds while preserving content images', () => {
    const html = prepareDigestEmailHtml(`
      <html>
        <body>
          <img src="https://images.test/creative.png" width="600" height="200">
          <img src="https://track.test/open" width="1" height="1">
          <img src="https://track.test/open-style" style="height: 1px; width: 1px; display: none">
          <script>window.location = 'https://example.com'</script>
          <iframe src="https://example.com"></iframe>
        </body>
      </html>
    `);

    expect(html).toContain('https://images.test/creative.png');
    expect(html).not.toContain('https://track.test/open');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<iframe');
  });
});
