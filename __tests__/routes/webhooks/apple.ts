import appFunc from '../../../src';
import { FastifyInstance } from 'fastify';

import request from 'supertest';
import { generateKeyPairSync, type ECKeyPairOptions } from 'crypto';
import { sign } from 'jsonwebtoken';
import createOrGetConnection from '../../../src/db';
import { User } from '../../../src/entity';
import { saveFixtures } from '../../helpers';

function createSignedData(payload): string {
  const keyPairOptions: ECKeyPairOptions<'pem', 'pem'> = {
    namedCurve: 'prime256v1',
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  };
  const keypair = generateKeyPairSync('ec', keyPairOptions);
  const privateKey = keypair.privateKey;
  return sign(payload, privateKey, { algorithm: 'ES256' });
}

let app: FastifyInstance;
let con: DataSource;

beforeAll(async () => {
  app = await appFunc();
  con = await createOrGetConnection();
  return app.ready();
});

afterAll(() => app.close());

beforeEach(async () => {
  jest.resetAllMocks();
});

describe('POST /webhooks/apple/notifications', () => {
  const signedPayload = createSignedData({
    notificationType: 'SUBSCRIBED',
    subtype: 'INITIAL_BUY',
    notificationUUID: '002e14d5-51f5-4503-b5a8-c3a1af68eb20',
    data: {
      environment: 'LocalTesting',
      appAppleId: 41234,
      bundleId: 'dev.fylla',
      bundleVersion: '1.2.3',
      signedTransactionInfo: createSignedData({
        transactionId: '23456',
        originalTransactionId: '12345',
        webOrderLineItemId: '34343',
        bundleId: 'com.example',
        productId: 'com.example.product',
        subscriptionGroupIdentifier: '55555',
        purchaseDate: 1698148900000,
        originalPurchaseDate: 1698148800000,
        expiresDate: 1698149000000,
        quantity: 1,
        type: 'Auto-Renewable Subscription',
        appAccountToken: '7e3fb20b-4cdb-47cc-936d-99d65f608138',
        inAppOwnershipType: 'PURCHASED',
        signedDate: 1698148900000,
        revocationReason: 1,
        revocationDate: 1698148950000,
        isUpgraded: true,
        offerType: 1,
        offerIdentifier: 'abc.123',
        environment: 'LocalTesting',
        transactionReason: 'PURCHASE',
        storefront: 'USA',
        storefrontId: '143441',
        price: 10990,
        currency: 'USD',
        offerDiscountType: 'PAY_AS_YOU_GO',
        appTransactionId: '71134',
        offerPeriod: 'P1Y',
      }),
      signedRenewalInfo: createSignedData({
        expirationIntent: 1,
        originalTransactionId: '12345',
        autoRenewProductId: 'com.example.product.2',
        productId: 'com.example.product',
        autoRenewStatus: 1,
        isInBillingRetryPeriod: true,
        priceIncreaseStatus: 0,
        gracePeriodExpiresDate: 1698148900000,
        offerType: 2,
        offerIdentifier: 'abc.123',
        signedDate: 1698148800000,
        environment: 'LocalTesting',
        recentSubscriptionStartDate: 1698148800000,
        renewalDate: 1698148850000,
        renewalPrice: 9990,
        currency: 'USD',
        offerDiscountType: 'PAY_AS_YOU_GO',
        eligibleWinBackOfferIds: ['eligible1', 'eligible2'],
        appTransactionId: '71134',
        offerPeriod: 'P1Y',
        appAccountToken: '7e3fb20b-4cdb-47cc-936d-99d65f608138',
      }),
      status: 1,
    },
    version: '2.0',
    signedDate: 1698148900000,
  });

  beforeEach(async () => {
    await saveFixtures(con, User, [
      {
        id: 'storekit-user-0',
        username: 'storekit-user-0',
        subscriptionFlags: {
          appAccountToken: '7e3fb20b-4cdb-47cc-936d-99d65f608138',
        },
      },
    ]);
  });

  it('should return 403 when IP address is not in list of approved IPs', async () => {
    const { body } = await request(app.server)
      .post('/webhooks/apple/notifications')
      .set('X-Forwarded-For', '8.8.8.8') // Set client IP
      .send({ signedPayload })
      .expect(403);

    expect(body.error).toEqual('Forbidden');
  });

  it('should return 403 when payload is incorrect', async () => {
    const { body } = await request(app.server)
      .post('/webhooks/apple/notifications')
      .send({
        signedPayload: 'wolololo',
      })
      .expect(403);

    expect(body.error).toEqual('Invalid Payload');
  });

  it('should return 200 when payload is correct', async () => {
    await request(app.server)
      .post('/webhooks/apple/notifications')
      .send({ signedPayload })
      .expect(200);
  });
});
