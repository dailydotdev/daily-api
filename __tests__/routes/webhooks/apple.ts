import appFunc from '../../../src';
import { FastifyInstance } from 'fastify';

import request from 'supertest';
import type { DataSource } from 'typeorm';
import { generateKeyPairSync, type ECKeyPairOptions } from 'crypto';
import { sign } from 'jsonwebtoken';
import createOrGetConnection from '../../../src/db';
import {
  ExperimentVariant,
  ExperimentVariantType,
  User,
} from '../../../src/entity';
import {
  createMockNjordErrorTransport,
  createMockNjordTransport,
  saveFixtures,
} from '../../helpers';
import {
  NotificationTypeV2,
  Subtype,
  type JWSRenewalInfoDecodedPayload,
  type JWSTransactionDecodedPayload,
} from '@apple/app-store-server-library';
import { SubscriptionCycles } from '../../../src/paddle';
import nock from 'nock';
import { env } from 'process';
import { deleteRedisKey, getRedisHash } from '../../../src/redis';
import { StorageKey } from '../../../src/config';
import { createClient } from '@connectrpc/connect';
import { Credits, TransferStatus } from '@dailydotdev/schema';
import * as njordCommon from '../../..//src/common/njord';
import { getTransactionForProviderId } from '../../../src/common/paddle';
import { UserTransactionProcessor } from '../../../src/entity/user/UserTransaction';
import {
  CORES_FEATURE_KEY,
  DEFAULT_CORES_METADATA,
} from '../../../src/common/paddle/pricing';
import {
  SubscriptionProvider,
  SubscriptionStatus,
} from '../../../src/common/plus';

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

const mockedURL = 'https://openexchangerates.org';
const mockedResponse = {
  disclaimer: 'Usage subject to terms: https://openexchangerates.org/terms',
  license: 'https://openexchangerates.org/license',
  timestamp: 1742295600,
  base: 'USD',
  rates: {
    USD: 1,
    NOK: 10.5,
    EUR: 0.9,
    GBP: 0.8,
  },
};

beforeAll(async () => {
  app = await appFunc();
  con = await createOrGetConnection();
  return app.ready();
});

afterAll(() => app.close());

beforeEach(async () => {
  jest.clearAllMocks();
  nock.cleanAll();
  await deleteRedisKey(StorageKey.OpenExchangeRates);

  nock(mockedURL)
    .get('/api/latest.json')
    .query({
      app_id: env.OPEN_EXCHANGE_RATES_APP_ID,
    })
    .reply(200, mockedResponse);
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
          bundleId: 'dev.fylla',
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
      {
        id: 'paddle-user-0',
        username: 'paddle-user-0',
        subscriptionFlags: {
          subscriptionId: 'paddle-subscription-id',
          provider: SubscriptionProvider.Paddle,
          status: SubscriptionStatus.Active,
          appAccountToken: '4b1d83a3-163e-4434-a502-96fb2a516a51',
        },
      },
    ]);
  });

  afterEach(async () => {
    await saveFixtures(con, User, [
      {
        id: 'storekit-user-0',
        username: 'storekit-user-0',
        subscriptionFlags: {},
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
            signedTransactionInfo: {
              productId: 'non-existing',
            },
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
            signedTransactionInfo: {
              appAccountToken: 'non-existing',
            },
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
    expect(user.subscriptionFlags?.status).toEqual(SubscriptionStatus.Active);
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
    expect(user.subscriptionFlags?.status).toEqual(SubscriptionStatus.Active);
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
      SubscriptionStatus.Cancelled,
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
    expect(user.subscriptionFlags?.status).toEqual(SubscriptionStatus.Expired);
    expect(user.subscriptionFlags?.provider).toBeUndefined();
  });

  it('should return error if user already has a paddle subscription', async () => {
    await request(app.server)
      .post('/webhooks/apple/notifications')
      .send({
        signedPayload: signedPayload({
          notificationType: NotificationTypeV2.SUBSCRIBED,
          data: {
            signedTransactionInfo: {
              appAccountToken: '4b1d83a3-163e-4434-a502-96fb2a516a51',
            },
            signedRenewalInfo: {
              appAccountToken: '4b1d83a3-163e-4434-a502-96fb2a516a51',
            },
          },
        }),
      })
      .expect(500);
  });

  it('should store exchange rates in redis', async () => {
    expect(await getRedisHash(StorageKey.OpenExchangeRates)).toEqual({});

    await request(app.server)
      .post('/webhooks/apple/notifications')
      .send({
        signedPayload: signedPayload({
          notificationType: NotificationTypeV2.DID_CHANGE_RENEWAL_STATUS,
        }),
      })
      .expect(200);

    expect(await getRedisHash(StorageKey.OpenExchangeRates)).toEqual({
      USD: '1',
      NOK: '10.5',
      EUR: '0.9',
      GBP: '0.8',
    });
  });

  it('should leave subscription in current state when consumption request is received', async () => {
    await request(app.server)
      .post('/webhooks/apple/notifications')
      .send({
        signedPayload: signedPayload({
          notificationType: NotificationTypeV2.SUBSCRIBED,
        }),
      })
      .expect(200);

    await request(app.server)
      .post('/webhooks/apple/notifications')
      .send({
        signedPayload: signedPayload({
          notificationType: NotificationTypeV2.CONSUMPTION_REQUEST,
        }),
      })
      .expect(200);

    const user = await con
      .getRepository(User)
      .findOneByOrFail({ id: 'storekit-user-0' });

    expect(user.subscriptionFlags?.cycle).toEqual(SubscriptionCycles.Yearly);
    expect(user.subscriptionFlags?.status).toEqual(SubscriptionStatus.Active);
    expect(user.subscriptionFlags?.provider).toEqual(
      SubscriptionProvider.AppleStoreKit,
    );
  });

  it('should leave subscription in current state when refund is declined', async () => {
    await request(app.server)
      .post('/webhooks/apple/notifications')
      .send({
        signedPayload: signedPayload({
          notificationType: NotificationTypeV2.SUBSCRIBED,
        }),
      })
      .expect(200);

    await request(app.server)
      .post('/webhooks/apple/notifications')
      .send({
        signedPayload: signedPayload({
          notificationType: NotificationTypeV2.REFUND_DECLINED,
        }),
      })
      .expect(200);

    const user = await con
      .getRepository(User)
      .findOneByOrFail({ id: 'storekit-user-0' });

    expect(user.subscriptionFlags?.cycle).toEqual(SubscriptionCycles.Yearly);
    expect(user.subscriptionFlags?.status).toEqual(SubscriptionStatus.Active);
    expect(user.subscriptionFlags?.provider).toEqual(
      SubscriptionProvider.AppleStoreKit,
    );
  });

  describe('cores', () => {
    const mockTransport = createMockNjordTransport();

    beforeEach(async () => {
      jest
        .spyOn(njordCommon, 'getNjordClient')
        .mockImplementation(() => createClient(Credits, mockTransport));

      await saveFixtures(con, User, [
        {
          id: 'storekit-user-c-1',
          username: 'storekit-user-c-1',
          subscriptionFlags: {
            appAccountToken: '18138f83-b4d3-456a-831f-1f3f7bcbb0bd',
          },
          coresRole: 3,
        },
        {
          id: 'storekit-user-c-2',
          username: 'storekit-user-c-2',
          subscriptionFlags: {
            appAccountToken: 'd9db8906-9b8b-44bc-bc35-3ac0515bad0c',
          },
          coresRole: 0,
        },
        {
          id: 'storekit-user-c-3',
          username: 'storekit-user-c-3',
          subscriptionFlags: {
            appAccountToken: 'edd16b7c-9717-4a2b-8b51-13ed104d7296',
          },
          coresRole: 1,
        },
      ]);

      await saveFixtures(con, ExperimentVariant, [
        {
          feature: CORES_FEATURE_KEY,
          variant: DEFAULT_CORES_METADATA,
          value: JSON.stringify([
            {
              appsId: 'custom',
              title: 'Cores 100',
              idMap: {
                paddle: 'pri_custom',
                ios: 'cores_100',
              },
              coresValue: 100,
            },
          ]),
          type: ExperimentVariantType.ProductPricing,
        },
      ]);
    });

    it('should purchase cores', async () => {
      const purchaseCoresSpy = jest.spyOn(njordCommon, 'purchaseCores');

      await request(app.server)
        .post('/webhooks/apple/notifications')
        .send({
          signedPayload: signedPayload({
            notificationType: NotificationTypeV2.ONE_TIME_CHARGE,
            data: {
              signedTransactionInfo: {
                productId: 'cores_100',
                quantity: 1,
                type: 'Consumable',
                appAccountToken: '18138f83-b4d3-456a-831f-1f3f7bcbb0bd',
                transactionId: '220698',
              },
            },
          }),
        })
        .expect(200);

      expect(purchaseCoresSpy).toHaveBeenCalledTimes(1);

      const userTransaction = await getTransactionForProviderId({
        con,
        providerId: '220698',
      });

      expect(userTransaction).toEqual({
        id: expect.any(String),
        createdAt: expect.any(Date),
        fee: 0,
        flags: {
          providerId: '220698',
        },
        processor: UserTransactionProcessor.AppleStoreKit,
        productId: null,
        receiverId: 'storekit-user-c-1',
        referenceId: null,
        referenceType: null,
        request: {},
        senderId: null,
        status: 0,
        updatedAt: expect.any(Date),
        value: 100,
        valueIncFees: 100,
      });
    });

    it('transaction completed throw if user coresRole is none', async () => {
      const purchaseCoresSpy = jest.spyOn(njordCommon, 'purchaseCores');

      await request(app.server)
        .post('/webhooks/apple/notifications')
        .send({
          signedPayload: signedPayload({
            notificationType: NotificationTypeV2.ONE_TIME_CHARGE,
            data: {
              signedTransactionInfo: {
                productId: 'cores_100',
                quantity: 1,
                type: 'Consumable',
                appAccountToken: 'd9db8906-9b8b-44bc-bc35-3ac0515bad0c',
                transactionId: '220698',
              },
            },
          }),
        })
        .expect(500);

      expect(purchaseCoresSpy).toHaveBeenCalledTimes(0);

      const userTransaction = await getTransactionForProviderId({
        con,
        providerId: '220698',
      });
      expect(userTransaction).toBeNull();
    });

    it('transaction completed throw if user coresRole is readonly', async () => {
      const purchaseCoresSpy = jest.spyOn(njordCommon, 'purchaseCores');

      await request(app.server)
        .post('/webhooks/apple/notifications')
        .send({
          signedPayload: signedPayload({
            notificationType: NotificationTypeV2.ONE_TIME_CHARGE,
            data: {
              signedTransactionInfo: {
                productId: 'cores_100',
                quantity: 1,
                type: 'Consumable',
                appAccountToken: 'edd16b7c-9717-4a2b-8b51-13ed104d7296',
                transactionId: '220698',
              },
            },
          }),
        })
        .expect(500);

      expect(purchaseCoresSpy).toHaveBeenCalledTimes(0);

      const userTransaction = await getTransactionForProviderId({
        con,
        providerId: '220698',
      });
      expect(userTransaction).toBeNull();
    });

    it('should error purchase on njord error', async () => {
      jest.spyOn(njordCommon, 'getNjordClient').mockImplementation(() =>
        createClient(
          Credits,
          createMockNjordErrorTransport({
            errorStatus: TransferStatus.INSUFFICIENT_FUNDS,
            errorMessage: 'Insufficient funds',
          }),
        ),
      );

      const purchaseCoresSpy = jest.spyOn(njordCommon, 'purchaseCores');

      await request(app.server)
        .post('/webhooks/apple/notifications')
        .send({
          signedPayload: signedPayload({
            notificationType: NotificationTypeV2.ONE_TIME_CHARGE,
            data: {
              signedTransactionInfo: {
                productId: 'cores_100',
                quantity: 1,
                type: 'Consumable',
                appAccountToken: '18138f83-b4d3-456a-831f-1f3f7bcbb0bd',
                transactionId: '200166',
              },
            },
          }),
        })
        .expect(200);

      expect(purchaseCoresSpy).toHaveBeenCalledTimes(1);

      const userTransaction = await getTransactionForProviderId({
        con,
        providerId: '200166',
      });

      expect(userTransaction).toEqual({
        id: expect.any(String),
        createdAt: expect.any(Date),
        fee: 0,
        flags: {
          providerId: '200166',
          error: 'Insufficient Cores balance.',
        },
        processor: UserTransactionProcessor.AppleStoreKit,
        productId: null,
        receiverId: 'storekit-user-c-1',
        referenceId: null,
        referenceType: null,
        request: {},
        senderId: null,
        status: 1,
        updatedAt: expect.any(Date),
        value: 100,
        valueIncFees: 100,
      });
    });
  });
});
