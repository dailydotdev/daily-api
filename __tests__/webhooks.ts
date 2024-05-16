import appFunc from '../src';
import { FastifyInstance } from 'fastify';
import { saveFixtures } from './helpers';
import { MarketingCta, Source, User, UserMarketingCta } from '../src/entity';
import { marketingCtaFixture, sourcesFixture, usersFixture } from './fixture';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import request from 'supertest';
import { createHmac } from 'crypto';
import {
  deleteKeysByPattern,
  getRedisObject,
  setRedisObject,
} from '../src/redis';
import { StorageKey, StorageTopic, generateStorageKey } from '../src/config';

let app: FastifyInstance;
let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
  app = await appFunc();
  return app.ready();
});

afterAll(() => app.close());

beforeEach(async () => {
  jest.resetAllMocks();
  await deleteKeysByPattern(
    generateStorageKey(StorageTopic.Boot, StorageKey.MarketingCta, '*'),
  );
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, MarketingCta, marketingCtaFixture);
});

describe('POST /webhooks/customerio/marketing_cta', () => {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = {
    userId: '1',
    marketingCtaId: 'worlds-best-campaign',
  };
  const hmac = createHmac('sha256', process.env.CIO_WEBHOOK_SECRET as string);
  hmac.update(`v0:${timestamp}:${JSON.stringify(payload)}`);
  const hash = hmac.digest().toString('hex');

  describe('webhook signature verification', () => {
    it('should return 403 when no x-cio-timestamp header', async () => {
      const { body } = await request(app.server)
        .post('/webhooks/customerio/marketing_cta')
        .set('x-cio-signature', '123')
        .send({
          userId: '1',
          marketingCtaId: 'worlds-best-campaign',
        })
        .expect(403);

      expect(body.error).toEqual('Invalid signature');
    });

    it('should return 403 when no x-cio-signature header', async () => {
      const { body } = await request(app.server)
        .post('/webhooks/customerio/marketing_cta')
        .set('x-cio-timestamp', '123')
        .send({
          userId: '1',
          marketingCtaId: 'worlds-best-campaign',
        })
        .expect(403);

      expect(body.error).toEqual('Invalid signature');
    });

    it('should return 200 when signature is valid (static)', async () => {
      const timestamp = 1715784949;
      const payload = {
        userId: '1',
        marketingCtaId: 'worlds-best-campaign',
      };
      const hash =
        'b01e7dfc3ce67eaab1010b7021b86ce2ba12677d191e0e04b14cd859e347f866';
      const { body } = await request(app.server)
        .post('/webhooks/customerio/marketing_cta')
        .set('x-cio-timestamp', timestamp.toString())
        .set('x-cio-signature', hash)
        .send(payload)
        .expect(200);

      expect(body.success).toEqual(true);
    });

    it('should return 200 when signature is valid (dynamic)', async () => {
      const { body } = await request(app.server)
        .post('/webhooks/customerio/marketing_cta')
        .set('x-cio-timestamp', timestamp.toString())
        .set('x-cio-signature', hash)
        .send(payload)
        .expect(200);

      expect(body.success).toEqual(true);
    });
  });

  it('should return 200 and insert user marketing cta', async () => {
    const { body } = await request(app.server)
      .post('/webhooks/customerio/marketing_cta')
      .set('x-cio-timestamp', timestamp.toString())
      .set('x-cio-signature', hash)
      .send(payload)
      .expect(200);

    expect(body.success).toEqual(true);

    const userMarketingCta = await con
      .getRepository(UserMarketingCta)
      .findOneBy({ userId: '1', marketingCtaId: 'worlds-best-campaign' });

    expect(userMarketingCta).toMatchObject({
      userId: '1',
      marketingCtaId: 'worlds-best-campaign',
    });

    expect(
      JSON.parse(
        (await getRedisObject(
          generateStorageKey(StorageTopic.Boot, StorageKey.MarketingCta, '1'),
        )) as string,
      ),
    ).toMatchObject({
      campaignId: 'worlds-best-campaign',
      createdAt: '2024-05-13T12:00:00.000Z',
      variant: 'card',
      status: 'active',
      flags: {
        title: 'Join the best community in the world',
        ctaUrl: 'http://localhost:5002',
        ctaText: 'Join now',
        description: 'Join the best community in the world',
      },
    });
  });

  it('should not change redis cache if existing cache exists', async () => {
    const redisKey = generateStorageKey(
      StorageTopic.Boot,
      StorageKey.MarketingCta,
      '1',
    );
    const { body } = await request(app.server)
      .post('/webhooks/customerio/marketing_cta')
      .set('x-cio-timestamp', timestamp.toString())
      .set('x-cio-signature', hash)
      .send(payload)
      .expect(200);

    await setRedisObject(redisKey, 'some value');
    const userMarketingCta = await con
      .getRepository(UserMarketingCta)
      .findOneBy({ userId: '1', marketingCtaId: 'worlds-best-campaign' });

    expect(userMarketingCta).toMatchObject({
      userId: '1',
      marketingCtaId: 'worlds-best-campaign',
    });
    expect(body.success).toEqual(true);
    expect(await getRedisObject(redisKey)).toEqual('some value');
  });
});
