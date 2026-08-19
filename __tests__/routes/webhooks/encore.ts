import { FastifyInstance } from 'fastify';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createHmac } from 'crypto';
import appFunc from '../../../src';
import createOrGetConnection from '../../../src/db';
import { EncoreOfferCompletion } from '../../../src/entity/EncoreOfferCompletion';

let app: FastifyInstance;
let con: DataSource;

const webhookSecret = 'whsec_test_secret';

const payload = {
  event: 'offer_completed',
  timestamp: '2026-08-18T10:30:00.000Z',
  transactionId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
  userId: 'u1',
  campaignName: 'Audible Premium Plus',
  payout: 10,
};

const signedPost = (
  body: object,
  {
    secret = webhookSecret,
    timestamp = Math.floor(Date.now() / 1000),
  }: { secret?: string; timestamp?: number } = {},
) => {
  const raw = JSON.stringify(body);
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${raw}`)
    .digest('hex');

  return request(app.server)
    .post('/webhooks/encore')
    .set('Content-Type', 'application/json')
    .set('X-Webhook-Signature', signature)
    .set('X-Webhook-Timestamp', timestamp.toString())
    .send(raw);
};

beforeAll(async () => {
  con = await createOrGetConnection();
  app = await appFunc();
  return app.ready();
});

afterAll(() => app.close());

beforeEach(async () => {
  process.env.ENCORE_WEBHOOK_SECRET = webhookSecret;
  await con
    .getRepository(EncoreOfferCompletion)
    .createQueryBuilder()
    .delete()
    .execute();
});

it('should reject an invalid signature', async () => {
  await signedPost(payload, { secret: 'whsec_wrong' }).expect(403);

  expect(await con.getRepository(EncoreOfferCompletion).count()).toBe(0);
});

it('should reject a stale timestamp', async () => {
  await signedPost(payload, {
    timestamp: Math.floor(Date.now() / 1000) - 10 * 60,
  }).expect(403);

  expect(await con.getRepository(EncoreOfferCompletion).count()).toBe(0);
});

it('should store the completion', async () => {
  await signedPost(payload).expect(200);

  const stored = await con
    .getRepository(EncoreOfferCompletion)
    .findOneByOrFail({ transactionId: payload.transactionId });
  expect(stored).toMatchObject({
    userId: 'u1',
    campaignName: 'Audible Premium Plus',
    payout: 10,
    completedAt: new Date(payload.timestamp),
  });
});

it('should store a null payout', async () => {
  await signedPost({ ...payload, payout: null }).expect(200);

  const stored = await con
    .getRepository(EncoreOfferCompletion)
    .findOneByOrFail({ transactionId: payload.transactionId });
  expect(stored.payout).toBeNull();
});

it('should ignore duplicate transaction ids', async () => {
  await signedPost(payload).expect(200);
  await signedPost({ ...payload, payout: 999 }).expect(200);

  const rows = await con.getRepository(EncoreOfferCompletion).find();
  expect(rows).toHaveLength(1);
  expect(rows[0].payout).toBe(10);
});

it('should acknowledge unknown payload shapes without storing', async () => {
  await signedPost({ event: 'something_else' }).expect(200);

  expect(await con.getRepository(EncoreOfferCompletion).count()).toBe(0);
});

it('should return 503 when the secret is not configured', async () => {
  delete process.env.ENCORE_WEBHOOK_SECRET;

  await signedPost(payload).expect(503);
});
