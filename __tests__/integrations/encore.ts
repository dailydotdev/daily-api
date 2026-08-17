import nock from 'nock';
import { EncoreClient } from '../../src/integrations/encore/clients';
import { GarmrNoopService } from '../../src/integrations/garmr';
import { HttpError } from '../../src/integrations/retry';

const origin = 'http://localhost:6789';
const apiKey = 'pk_test_key';
const clientId = 'daily.dev';

const client = new EncoreClient(origin, apiKey, clientId, {
  garmr: new GarmrNoopService(),
});

const impressionUid = '550e8400-e29b-41d4-a716-446655440000';
const feedResponse = {
  success: true,
  offers: [
    {
      impressionUid,
      clickUrl: 'https://link.encorekit.com/Xa3kPq7T',
      title: 'Get 50% Off',
      description: 'Limited time offer',
      imageUrl: 'https://cdn.example.com/banner.png',
      additionalImages: [],
      advertiserName: 'Acme',
      advertiserLogo: null,
      perk: '3 months free',
      badgeLabel: 'discount',
    },
  ],
};

afterEach(() => {
  nock.cleanAll();
});

describe('EncoreClient.getOffersFeed', () => {
  it('should POST the feed request with clientId and api key header', async () => {
    let requestBody: Record<string, unknown> = {};
    nock(origin, {
      reqheaders: { 'x-api-key': apiKey, 'content-type': 'application/json' },
    })
      .post('/offers/feed', (body) => {
        requestBody = body;
        return true;
      })
      .reply(200, feedResponse);

    const result = await client.getOffersFeed({
      userId: 'u1',
      limit: 3,
      attributes: { countryCode: 'US', language: 'en', platform: 'web' },
    });

    expect(result).toEqual(feedResponse);
    expect(requestBody).toEqual({
      clientId,
      userId: 'u1',
      limit: 3,
      attributes: { countryCode: 'US', language: 'en', platform: 'web' },
    });
  });

  it('should throw HttpError on non-2xx responses', async () => {
    nock(origin).post('/offers/feed').reply(503, 'unavailable');

    await expect(
      client.getOffersFeed({
        userId: 'u1',
        attributes: { countryCode: 'US', language: 'en' },
      }),
    ).rejects.toThrow(HttpError);
  });

  it('should throw when origin or api key is missing', async () => {
    const unconfigured = new EncoreClient('', '', clientId, {
      garmr: new GarmrNoopService(),
    });

    await expect(
      unconfigured.getOffersFeed({
        userId: 'u1',
        attributes: { countryCode: 'US', language: 'en' },
      }),
    ).rejects.toThrow('Missing ENCORE_ORIGIN or ENCORE_API_KEY');
  });
});

describe('EncoreClient.confirmDelivered', () => {
  it('should POST the delivered confirmation for the impression', async () => {
    let requestBody: Record<string, unknown> = {};
    nock(origin, { reqheaders: { 'x-api-key': apiKey } })
      .post(`/offers/impressions/${impressionUid}/delivered`, (body) => {
        requestBody = body;
        return true;
      })
      .reply(202, { success: true });

    await client.confirmDelivered(impressionUid, 1755000000);

    expect(requestBody).toEqual({ deliveredTimestamp: 1755000000 });
  });

  it('should throw HttpError when the confirmation fails', async () => {
    nock(origin)
      .post(`/offers/impressions/${impressionUid}/delivered`)
      .reply(400, 'bad uuid');

    await expect(
      client.confirmDelivered(impressionUid, 1755000000),
    ).rejects.toThrow(HttpError);
  });
});
