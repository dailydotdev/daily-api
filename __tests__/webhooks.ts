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
  RedisMagicValues,
  deleteKeysByPattern,
  getRedisObject,
  setRedisObject,
} from '../src/redis';
import { StorageKey, StorageTopic, generateStorageKey } from '../src/config';
import nock from 'nock';

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

  const redisKey = generateStorageKey(
    StorageTopic.Boot,
    StorageKey.MarketingCta,
    '1',
  );

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

  describe('assign user to marketing cta', () => {
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
        .findOneBy(payload);

      expect(userMarketingCta).toMatchObject({
        userId: '1',
        marketingCtaId: 'worlds-best-campaign',
      });

      expect(
        JSON.parse((await getRedisObject(redisKey)) as string),
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

    it('should change redis cache if sleeping', async () => {
      await setRedisObject(redisKey, RedisMagicValues.SLEEPING);

      const { body } = await request(app.server)
        .post('/webhooks/customerio/marketing_cta')
        .set('x-cio-timestamp', timestamp.toString())
        .set('x-cio-signature', hash)
        .send(payload)
        .expect(200);

      const userMarketingCta = await con
        .getRepository(UserMarketingCta)
        .findOneBy(payload);

      expect(userMarketingCta).toMatchObject({
        userId: '1',
        marketingCtaId: 'worlds-best-campaign',
      });
      expect(body.success).toEqual(true);
      expect(
        JSON.parse((await getRedisObject(redisKey)) as string),
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

    it('should set the redis cache to the first in the queue', async () => {
      await con.getRepository(UserMarketingCta).insert({
        userId: '1',
        marketingCtaId: 'worlds-second-best-campaign',
        createdAt: new Date('2024-05-13T12:00:00.000Z'),
      });

      const { body } = await request(app.server)
        .post('/webhooks/customerio/marketing_cta')
        .set('x-cio-timestamp', timestamp.toString())
        .set('x-cio-signature', hash)
        .send(payload)
        .expect(200);

      const userMarketingCta = await con
        .getRepository(UserMarketingCta)
        .findBy({
          userId: '1',
          marketingCtaId: 'worlds-best-campaign',
        });

      userMarketingCta.forEach((umc) => {
        expect([
          'worlds-best-campaign',
          'worlds-second-best-campaign',
        ]).toContain(umc.marketingCtaId);
      });

      expect(body.success).toEqual(true);
      expect(
        JSON.parse((await getRedisObject(redisKey)) as string),
      ).toMatchObject({
        campaignId: 'worlds-second-best-campaign',
        createdAt: '2024-05-14T12:00:00.000Z',
        variant: 'card',
        status: 'active',
        flags: {
          title: 'Join the second best community in the world',
          ctaUrl: 'http://localhost:5002',
          ctaText: 'Join now',
          description: 'Join the second best community in the world',
        },
      });
    });

    it('should return 400 when error processing webhook', async () => {
      await con.getRepository(MarketingCta).delete({
        campaignId: 'worlds-best-campaign',
      });

      const { body } = await request(app.server)
        .post('/webhooks/customerio/marketing_cta')
        .set('x-cio-timestamp', timestamp.toString())
        .set('x-cio-signature', hash)
        .send(payload)
        .expect(400);

      const userMarketingCta = await con
        .getRepository(UserMarketingCta)
        .findOneBy(payload);

      expect(userMarketingCta).toBeNull();
      expect(body.success).toEqual(false);
    });
  });

  describe('unassign user from marketing cta', () => {
    beforeEach(async () => {
      await con.getRepository(UserMarketingCta).insert({
        userId: '1',
        marketingCtaId: 'worlds-best-campaign',
      });
    });

    it('should return 200 and delete user marketing cta', async () => {
      expect(
        await con.getRepository(UserMarketingCta).findOneBy(payload),
      ).toMatchObject({
        userId: '1',
        marketingCtaId: 'worlds-best-campaign',
      });

      const { body } = await request(app.server)
        .delete('/webhooks/customerio/marketing_cta')
        .set('x-cio-timestamp', timestamp.toString())
        .set('x-cio-signature', hash)
        .send(payload)
        .expect(200);

      expect(body.success).toEqual(true);
      expect(
        await con.getRepository(UserMarketingCta).findOneBy(payload),
      ).toBeNull();
      expect(await getRedisObject(redisKey)).toEqual(RedisMagicValues.SLEEPING);
    });

    it('should preload the next available', async () => {
      await con.getRepository(UserMarketingCta).insert({
        userId: '1',
        marketingCtaId: 'worlds-second-best-campaign',
        createdAt: new Date('2024-05-13T12:00:00.000Z'),
      });

      expect(
        await con.getRepository(UserMarketingCta).findBy({ userId: '1' }),
      ).toHaveLength(2);

      const { body } = await request(app.server)
        .delete('/webhooks/customerio/marketing_cta')
        .set('x-cio-timestamp', timestamp.toString())
        .set('x-cio-signature', hash)
        .send(payload)
        .expect(200);

      expect(body.success).toEqual(true);

      expect(
        await con.getRepository(UserMarketingCta).findBy({ userId: '1' }),
      ).toHaveLength(1);
      expect(
        await con.getRepository(UserMarketingCta).findOneBy(payload),
      ).toBeNull();
      expect(
        JSON.parse((await getRedisObject(redisKey)) as string),
      ).toMatchObject({
        campaignId: 'worlds-second-best-campaign',
        createdAt: '2024-05-14T12:00:00.000Z',
        variant: 'card',
        status: 'active',
        flags: {
          title: 'Join the second best community in the world',
          ctaUrl: 'http://localhost:5002',
          ctaText: 'Join now',
          description: 'Join the second best community in the world',
        },
      });
    });
  });
});

describe('POST /webhooks/customerio/reporting', () => {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = {
    event_id: 'e1',
    timestamp,
    object_type: 'email',
    metric: 'sent',
    data: {
      identifiers: {
        id: 'u1',
      },
      recipient: 'email@domain.com',
      transactional_message_id: '9',
    },
  };
  const hmac = createHmac(
    'sha256',
    process.env.CIO_REPORTING_WEBHOOK_SECRET as string,
  );
  hmac.update(`v0:${timestamp}:${JSON.stringify(payload)}`);
  const hash = hmac.digest().toString('hex');

  it('should return 403 when no x-cio-timestamp header', async () => {
    const { body } = await request(app.server)
      .post('/webhooks/customerio/reporting')
      .set('x-cio-signature', '123')
      .send(payload)
      .expect(403);

    expect(body.error).toEqual('Invalid signature');
  });

  it('should return 403 when no x-cio-signature header', async () => {
    const { body } = await request(app.server)
      .post('/webhooks/customerio/reporting')
      .set('x-cio-timestamp', '123')
      .send(payload)
      .expect(403);

    expect(body.error).toEqual('Invalid signature');
  });

  it('should return 200 when signature is valid', async () => {
    nock('http://localhost:5000')
      .post('/e', {
        events: [
          {
            event_id: 'e1',
            session_id: 'e1',
            visit_id: 'e1',
            event_timestamp: new Date(timestamp * 1000).toISOString(),
            user_id: 'u1',
            event_name: 'email sent',
            app_platform: 'customerio',
            extra: JSON.stringify({ transactional_message_id: '9' }),
          },
        ],
      })
      .reply(204);

    const { body } = await request(app.server)
      .post('/webhooks/customerio/reporting')
      .set('x-cio-timestamp', timestamp.toString())
      .set('x-cio-signature', hash)
      .send(payload)
      .expect(200);

    expect(body.success).toEqual(true);
  });
});
