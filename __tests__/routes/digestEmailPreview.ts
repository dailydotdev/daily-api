import fastify, { FastifyInstance } from 'fastify';
import request from 'supertest';
import CIORequest from 'customerio-node/dist/lib/request';
import digestEmailPreview, {
  prepareDigestEmailHtml,
} from '../../src/routes/private/digestEmailPreview';

jest.mock('customerio-node/dist/lib/request');

const mockGetArchivedMessage = jest.fn();
const mockCIORequest = CIORequest as jest.MockedClass<typeof CIORequest>;

let app: FastifyInstance;
const originalDigestSecret = process.env.PERSONALIZED_DIGEST_SECRET;
const originalCioAppKey = process.env.CIO_APP_KEY;

beforeAll(async () => {
  app = fastify();
  await app.register(digestEmailPreview, {
    prefix: '/p/digest/email-preview',
  });
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
  await app.close();
});

beforeEach(() => {
  jest.resetAllMocks();
  process.env.PERSONALIZED_DIGEST_SECRET = 'digest-secret';
  process.env.CIO_APP_KEY = 'cio-key';
  mockCIORequest.mockImplementation(
    () =>
      ({
        get: mockGetArchivedMessage,
      }) as unknown as CIORequest,
  );
});

describe('POST /p/digest/email-preview', () => {
  it('requires the digest service credential', async () => {
    await request(app.server)
      .post('/p/digest/email-preview')
      .send({ deliveryId: 'delivery-id' })
      .expect(401, { message: 'unauthorized' });

    expect(mockGetArchivedMessage).not.toHaveBeenCalled();
  });

  it('returns archived HTML without its tracking pixel', async () => {
    mockGetArchivedMessage.mockResolvedValue({
      archived_message: {
        body: `
          <body>
            <img src="https://images.test/creative.png" width="600" height="200">
            <img src="https://track.test/open" width="1" height="1">
          </body>
        `,
        hide_body: false,
      },
    });
    const response = await request(app.server)
      .post('/p/digest/email-preview')
      .set('authorization', 'Bearer digest-secret')
      .send({ deliveryId: 'delivery-id' })
      .expect(200);

    expect(response.headers).toMatchObject({
      'content-type': expect.stringContaining('application/json'),
      'cache-control': 'private, no-store',
      pragma: 'no-cache',
    });
    expect(response.body.html).toContain('https://images.test/creative.png');
    expect(response.body.html).not.toContain('https://track.test/open');
  });

  it('returns not found when Customer.io hides the archived body', async () => {
    mockGetArchivedMessage.mockResolvedValue({
      archived_message: { hide_body: true },
    });

    await request(app.server)
      .post('/p/digest/email-preview')
      .set('authorization', 'Bearer digest-secret')
      .send({ deliveryId: 'delivery-id' })
      .expect(404, { message: 'archived digest email is not available' });
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
          <form action="https://example.com"><button>Submit</button></form>
          <meta http-equiv="refresh" content="0;https://example.com">
        </body>
      </html>
    `);

    expect(html).toContain('https://images.test/creative.png');
    expect(html).not.toContain('https://track.test/open');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('<form');
    expect(html).not.toContain('http-equiv="refresh"');
  });
});
