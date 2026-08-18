import { FastifyInstance } from 'fastify';
import { DataSource } from 'typeorm';
import request from 'supertest';
import appFunc from '../../../src';
import createOrGetConnection from '../../../src/db';
import { EncoreOfferCompletion } from '../../../src/entity/EncoreOfferCompletion';

let app: FastifyInstance;
let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
  app = await appFunc();
  return app.ready();
});

afterAll(() => app.close());

beforeEach(async () => {
  await con
    .getRepository(EncoreOfferCompletion)
    .createQueryBuilder()
    .delete()
    .execute();
  await con.getRepository(EncoreOfferCompletion).save([
    {
      transactionId: '10000000-0000-4000-8000-000000000001',
      userId: 'u1',
      campaignName: 'Audible Premium Plus',
      payout: 10,
      completedAt: new Date('2026-08-16T08:00:00.000Z'),
    },
    {
      transactionId: '10000000-0000-4000-8000-000000000002',
      userId: 'u2',
      campaignName: 'Audible Premium Plus',
      payout: null,
      completedAt: new Date('2026-08-16T22:00:00.000Z'),
    },
    {
      transactionId: '10000000-0000-4000-8000-000000000003',
      userId: 'u1',
      campaignName: 'Acme Music',
      payout: 2.5,
      completedAt: new Date('2026-08-17T01:00:00.000Z'),
    },
    {
      transactionId: '10000000-0000-4000-8000-000000000004',
      userId: 'u3',
      campaignName: 'Acme Music',
      payout: 4,
      // outside the queried range
      completedAt: new Date('2026-08-18T00:00:00.000Z'),
    },
  ]);
});

it('should aggregate completions and revenue per day and campaign', async () => {
  const { body } = await request(app.server)
    .get('/p/encore-report')
    .query({ from: '2026-08-16', to: '2026-08-18' })
    .expect(200);

  expect(body.reports).toEqual([
    {
      date: '2026-08-16',
      campaignName: 'Audible Premium Plus',
      completions: 2,
      revenue: 10,
    },
    {
      date: '2026-08-17',
      campaignName: 'Acme Music',
      completions: 1,
      revenue: 2.5,
    },
  ]);
});

it('should reject an invalid range', async () => {
  await request(app.server)
    .get('/p/encore-report')
    .query({ from: 'nope', to: '2026-08-18' })
    .expect(400);
});
