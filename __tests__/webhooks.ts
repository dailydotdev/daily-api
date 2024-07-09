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
  getRedisListLength,
  getRedisObject,
  setRedisObject,
} from '../src/redis';
import { StorageKey, StorageTopic, generateStorageKey } from '../src/config';
import nock from 'nock';
import { triggerTypedEvent } from '../src/common';
import { NotificationPayload } from '../src/routes/webhooks/customerio';
import { sendGenericPush } from '../src/onesignal';

let app: FastifyInstance;
let con: DataSource;

const withSignature = (
  req,
  secret: string = process.env.CIO_WEBHOOK_SECRET as string,
) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const hmac = createHmac('sha256', secret);
  hmac.update(`v0:${timestamp}:${JSON.stringify(req['_data'])}`);
  const hash = hmac.digest().toString('hex');

  return req.set('x-cio-timestamp', timestamp).set('x-cio-signature', hash);
};

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
  await deleteKeysByPattern(
    generateStorageKey(StorageTopic.CIO, StorageKey.Reporting, 'global'),
  );
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, MarketingCta, marketingCtaFixture);
});

jest.mock('../src/common', () => ({
  ...(jest.requireActual('../src/common') as Record<string, unknown>),
  triggerTypedEvent: jest.fn(),
}));

jest.mock('../src/onesignal.ts', () => ({
  ...(jest.requireActual('../src/onesignal.ts') as Record<string, unknown>),
  sendGenericPush: jest.fn(),
}));

describe('POST /webhooks/customerio/marketing_cta', () => {
  const payload = {
    userId: '1',
    marketingCtaId: 'worlds-best-campaign',
  };

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
        .send(payload)
        .use(withSignature)
        .expect(200);

      expect(body.success).toEqual(true);
    });
  });

  describe('assign user to marketing cta', () => {
    it('should return 200 and insert user marketing cta', async () => {
      const { body } = await request(app.server)
        .post('/webhooks/customerio/marketing_cta')
        .send(payload)
        .use(withSignature)
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
        .send(payload)
        .use(withSignature)
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
        .send(payload)
        .use(withSignature)
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
        .send(payload)
        .use(withSignature)
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
        .post('/webhooks/customerio/marketing_cta/delete')
        .send(payload)
        .use(withSignature)
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
        .post('/webhooks/customerio/marketing_cta/delete')
        .send(payload)
        .use(withSignature)
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
    metric: 'subscribed',
    data: {
      identifiers: {
        id: 'u1',
      },
      recipient: 'email@domain.com',
      transactional_message_id: '9',
    },
  };

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
    const key = generateStorageKey(
      StorageTopic.CIO,
      StorageKey.Reporting,
      'global',
    );
    nock('http://localhost:5000')
      .post('/e', {
        events: [
          {
            event_id: 'e1',
            session_id: 'e1',
            visit_id: 'e1',
            event_timestamp: new Date(timestamp * 1000).toISOString(),
            user_id: 'u1',
            event_name: 'email subscribed',
            app_platform: 'customerio',
            extra: JSON.stringify({ transactional_message_id: '9' }),
          },
        ],
      })
      .reply(204);

    expect(await getRedisListLength(key)).toEqual(0);

    const { body } = await request(app.server)
      .post('/webhooks/customerio/reporting')
      .send(payload)
      .use((req) =>
        withSignature(req, process.env.CIO_REPORTING_WEBHOOK_SECRET as string),
      )
      .expect(200);

    expect(await getRedisListLength(key)).toEqual(1);

    expect(body.success).toEqual(true);
  });
});

describe('POST /webhooks/customerio/promote_post', () => {
  const payload = {
    userId: 'abc',
    postId: 'def',
  };

  it('should return 403 when no x-cio-timestamp header', async () => {
    const { body } = await request(app.server)
      .post('/webhooks/customerio/promote_post')
      .set('x-cio-signature', '123')
      .send(payload)
      .expect(403);

    expect(body.error).toEqual('Invalid signature');
  });

  it('should return 403 when no x-cio-signature header', async () => {
    const { body } = await request(app.server)
      .post('/webhooks/customerio/promote_post')
      .set('x-cio-timestamp', '123')
      .send(payload)
      .expect(403);

    expect(body.error).toEqual('Invalid signature');
  });

  it('should return 200 when signature is valid', async () => {
    const { body } = await request(app.server)
      .post('/webhooks/customerio/promote_post')
      .send(payload)
      .use(withSignature)
      .expect(200);

    expect(body.success).toEqual(true);

    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
    expect(jest.mocked(triggerTypedEvent).mock.calls[0].slice(1)[0]).toEqual(
      'api.v1.user-post-promoted',
    );
    expect(
      jest.mocked(triggerTypedEvent).mock.calls[0].slice(2)[0],
    ).toMatchObject({
      userId: 'abc',
      postId: 'def',
    });
  });
});

describe('POST /webhooks/customerio/notification', () => {
  const payload: NotificationPayload = {
    userIds: ['u1'],
    notification: {
      title: 'title',
      body: 'body',
      url: 'url',
      utm_campaign: 'utm_campaign',
    },
  };

  it('should return 403 when no x-cio-timestamp header', async () => {
    const { body } = await request(app.server)
      .post('/webhooks/customerio/notification')
      .set('x-cio-signature', '123')
      .send(payload)
      .expect(403);

    expect(body.error).toEqual('Invalid signature');
  });

  it('should return 403 when no x-cio-signature header', async () => {
    const { body } = await request(app.server)
      .post('/webhooks/customerio/notification')
      .set('x-cio-timestamp', '123')
      .send(payload)
      .expect(403);

    expect(body.error).toEqual('Invalid signature');
  });

  it('should return 200 when signature is valid', async () => {
    const { body } = await request(app.server)
      .post('/webhooks/customerio/notification')
      .send(payload)
      .use(withSignature)
      .expect(200);

    expect(body.success).toEqual(true);

    expect(sendGenericPush).toHaveBeenCalledTimes(1);
    expect(jest.mocked(sendGenericPush).mock.calls[0][0]).toMatchObject(['u1']);
    expect(jest.mocked(sendGenericPush).mock.calls[0][1]).toMatchObject({
      body: 'body',
      title: 'title',
      url: 'url',
      utm_campaign: 'utm_campaign',
    });
  });

  it('should remove duplicate userIds', async () => {
    const { body } = await request(app.server)
      .post('/webhooks/customerio/notification')
      .send({ ...payload, userIds: ['u1', 'u1', 'u2', 'u3'] })
      .use(withSignature)
      .expect(200);

    expect(body.success).toEqual(true);

    expect(sendGenericPush).toHaveBeenCalledTimes(1);
    expect(jest.mocked(sendGenericPush).mock.calls[0][0]).toMatchObject([
      'u1',
      'u2',
      'u3',
    ]);
    expect(jest.mocked(sendGenericPush).mock.calls[0][1]).toMatchObject({
      body: 'body',
      title: 'title',
      url: 'url',
      utm_campaign: 'utm_campaign',
    });
  });

  it('should return 400 when the payload is invalid', async () => {
    const { body } = await request(app.server)
      .post('/webhooks/customerio/notification')
      .send({ invalid: 'payload' })
      .use(withSignature)
      .expect(400);

    expect(body.success).toEqual(false);
  });
});
