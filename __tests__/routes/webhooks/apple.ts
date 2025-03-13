import appFunc from '../../../src';
import { FastifyInstance } from 'fastify';

import request from 'supertest';
import type { DataSource } from 'typeorm';
import { generateKeyPairSync, type ECKeyPairOptions } from 'crypto';
import { sign } from 'jsonwebtoken';
import createOrGetConnection from '../../../src/db';
import {
  SubscriptionProvider,
  User,
  UserSubscriptionStatus,
} from '../../../src/entity';
import { saveFixtures } from '../../helpers';
import {
  NotificationTypeV2,
  Subtype,
  type JWSRenewalInfoDecodedPayload,
  type JWSTransactionDecodedPayload,
} from '@apple/app-store-server-library';
import { SubscriptionCycles } from '../../../src/paddle';

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
  const signedPayload = ({
    notificationType,
    subtype,
    data,
  }: {
    notificationType: NotificationTypeV2;
    subtype?: Subtype;
    data?: {
      signedTransactionInfo?: JWSTransactionDecodedPayload;
      signedRenewalInfo?: JWSRenewalInfoDecodedPayload;
    };
  }) => {
    const { signedTransactionInfo, signedRenewalInfo } = data || {};
    return createSignedData({
      notificationType,
      subtype,
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
          productId: 'annual',
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
          ...signedTransactionInfo,
        }),
        signedRenewalInfo: createSignedData({
          expirationIntent: 1,
          originalTransactionId: '12345',
          autoRenewProductId: 'annual',
          productId: 'annual',
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
          ...signedRenewalInfo,
        }),
        status: 1,
      },
      version: '2.0',
      signedDate: 1698148900000,
    });
  };

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
      .send({
        signedPayload: signedPayload({
          notificationType: NotificationTypeV2.SUBSCRIBED,
        }),
      })
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

  it('should return 500 when payload is correct but not able to determine subscription cycle', async () => {
    await request(app.server)
      .post('/webhooks/apple/notifications')
      .send({
        signedPayload: signedPayload({
          notificationType: NotificationTypeV2.SUBSCRIBED,
          data: {
            signedRenewalInfo: {
              autoRenewProductId: 'non-existing',
            },
          },
        }),
      })
      .expect(500);
  });

  it('should return 404 when payload is correct but could not find user', async () => {
    await request(app.server)
      .post('/webhooks/apple/notifications')
      .send({
        signedPayload: signedPayload({
          notificationType: NotificationTypeV2.SUBSCRIBED,
          data: {
            signedRenewalInfo: {
              appAccountToken: 'non-existing',
            },
          },
        }),
      })
      .expect(404);
  });

  it('should return 200 when payload is correct', async () => {
    await request(app.server)
      .post('/webhooks/apple/notifications')
      .send({
        signedPayload: signedPayload({
          notificationType: NotificationTypeV2.SUBSCRIBED,
        }),
      })
      .expect(200);
  });

  it('should give user plus subscription when payload is correct', async () => {
    await request(app.server)
      .post('/webhooks/apple/notifications')
      .send({
        signedPayload: signedPayload({
          notificationType: NotificationTypeV2.SUBSCRIBED,
        }),
      })
      .expect(200);

    const user = await con
      .getRepository(User)
      .findOneByOrFail({ id: 'storekit-user-0' });

    expect(user.subscriptionFlags?.cycle).toEqual(SubscriptionCycles.Yearly);
    expect(user.subscriptionFlags?.status).toEqual(
      UserSubscriptionStatus.Active,
    );
    expect(user.subscriptionFlags?.provider).toEqual(
      SubscriptionProvider.AppleStoreKit,
    );
  });

  it('should renew user plus subscription when payload is correct', async () => {
    const newRenewalDate = new Date('Wed Mar 12 2025 12:16:51').getTime();
    await request(app.server)
      .post('/webhooks/apple/notifications')
      .send({
        signedPayload: signedPayload({
          notificationType: NotificationTypeV2.DID_RENEW,
          data: {
            signedRenewalInfo: {
              renewalDate: newRenewalDate,
            },
          },
        }),
      })
      .expect(200);

    const user = await con
      .getRepository(User)
      .findOneByOrFail({ id: 'storekit-user-0' });

    expect(user.subscriptionFlags?.cycle).toEqual(SubscriptionCycles.Yearly);
    expect(user.subscriptionFlags?.status).toEqual(
      UserSubscriptionStatus.Active,
    );
    expect(user.subscriptionFlags?.provider).toEqual(
      SubscriptionProvider.AppleStoreKit,
    );
    expect(user.subscriptionFlags?.expiresAt).toEqual(
      new Date(newRenewalDate).toISOString(),
    );
  });

  it('should cancel subscription when payload is correct', async () => {
    await request(app.server)
      .post('/webhooks/apple/notifications')
      .send({
        signedPayload: signedPayload({
          notificationType: NotificationTypeV2.DID_CHANGE_RENEWAL_STATUS,
        }),
      })
      .expect(200);

    const user = await con
      .getRepository(User)
      .findOneByOrFail({ id: 'storekit-user-0' });

    expect(user.subscriptionFlags?.cycle).toEqual(SubscriptionCycles.Yearly);
    expect(user.subscriptionFlags?.status).toEqual(
      UserSubscriptionStatus.Cancelled,
    );
    expect(user.subscriptionFlags?.provider).toEqual(
      SubscriptionProvider.AppleStoreKit,
    );
  });

  it('should expire subscription when payload is correct', async () => {
    await request(app.server)
      .post('/webhooks/apple/notifications')
      .send({
        signedPayload: signedPayload({
          notificationType: NotificationTypeV2.EXPIRED,
        }),
      })
      .expect(200);

    const user = await con
      .getRepository(User)
      .findOneByOrFail({ id: 'storekit-user-0' });

    expect(user.subscriptionFlags?.cycle).toBeUndefined();
    expect(user.subscriptionFlags?.status).toEqual(
      UserSubscriptionStatus.Expired,
    );
    expect(user.subscriptionFlags?.provider).toBeUndefined();
  });
});
