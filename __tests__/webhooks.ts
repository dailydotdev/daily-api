import appFunc from '../src';
import { FastifyInstance } from 'fastify';
import { saveFixtures } from './helpers';
import {
  MarketingCta,
  MarketingCtaStatus,
  Source,
  User,
  UserMarketingCta,
} from '../src/entity';
import { sourcesFixture } from './fixture/source';
import { usersFixture } from './fixture/user';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import request from 'supertest';
import { createHmac } from 'crypto';

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
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, MarketingCta, [
    {
      campaignId: 'worlds-best-campaign',
      variant: 'card',
      status: MarketingCtaStatus.Active,
      createdAt: new Date('2024-03-13 12:00:00'),
      flags: {
        title: 'Join the best community in the world',
        description: 'Join the best community in the world',
        ctaUrl: 'http://localhost:5002',
        ctaText: 'Join now',
      },
    },
  ]);
  await saveFixtures(
    con,
    UserMarketingCta,
    usersFixture.map((user) => ({
      marketingCtaId: 'worlds-best-campaign',
      userId: user.id,
      createdAt: new Date('2024-03-13 12:00:00'),
    })),
  );

  // usersFixture.forEach(async (user) => {
  //   await setRedisObject(
  //     generateStorageKey(
  //       StorageTopic.Boot,
  //       StorageKey.MarketingCta,
  //       user.id as string,
  //     ),
  //     // Don't really care about the value in these tests
  //     'not null',
  //   );
  // });
});

describe('POST /webhooks/customerio/marketing_cta', () => {
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
      const timestamp = Math.floor(Date.now() / 1000);
      const payload = {
        userId: '1',
        marketingCtaId: 'worlds-best-campaign',
      };
      const hmac = createHmac(
        'sha256',
        process.env.CIO_WEBHOOK_SECRET as string,
      );
      hmac.update(`v0:${timestamp}:${JSON.stringify(payload)}`);
      const hash = hmac.digest().toString('hex');

      const { body } = await request(app.server)
        .post('/webhooks/customerio/marketing_cta')
        .set('x-cio-timestamp', timestamp.toString())
        .set('x-cio-signature', hash)
        .send(payload)
        .expect(200);

      expect(body.success).toEqual(true);
    });
  });
});
