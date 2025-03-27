import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import {
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  type GraphQLTestingState,
  type GraphQLTestClient,
} from './helpers';
import { SubscriptionProvider, User } from '../src/entity';
import { plusUsersFixture, usersFixture } from './fixture';
import {
  EventName,
  SubscriptionCreatedEvent,
  TransactionCompletedEvent,
} from '@paddle/paddle-node-sdk';
import {
  PaddleCustomData,
  processGiftedPayment,
  updateUserSubscription,
} from '../src/routes/webhooks/paddle';
import { isPlusMember, SubscriptionCycles } from '../src/paddle';
import { FastifyInstance } from 'fastify';
import appFunc from '../src';
import { logger } from '../src/logger';
import { paddleInstance } from '../src/common/paddle';
import * as redisFile from '../src/redis';
import { ioRedisPool } from '../src/redis';

let app: FastifyInstance;
let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string = '';

beforeAll(async () => {
  con = await createOrGetConnection();
  app = await appFunc();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser),
  );
  client = state.client;
  return app.ready();
});

beforeEach(async () => {
  await saveFixtures(
    con,
    User,
    [...usersFixture, ...plusUsersFixture].map((user) => ({
      ...user,
      id: `whp-${user.id}`,
      flags: {
        vordr: false,
        trustScore: 1,
      },
    })),
  );
});

const getPricingPreviewData = () => ({
  details: {
    lineItems: [
      {
        price: {
          id: 'pri_monthly',
          name: 'Monthly Subscription',
          customData: {
            label: 'Monthly',
            appsId: 'monthly-sub',
          },
          billingCycle: {
            interval: 'month',
            frequency: 1,
          },
        },
        formattedTotals: {
          total: '$5.00',
        },
        totals: {
          total: '5.00',
        },
      },
      {
        price: {
          id: 'pri_yearly',
          name: 'Yearly Subscription',
          customData: {
            label: 'Yearly',
            appsId: 'yearly-sub',
          },
          billingCycle: {
            interval: 'year',
            frequency: 1,
          },
        },
        formattedTotals: {
          total: '$60.00',
        },
        totals: {
          total: '60.00',
        },
      },
    ],
  },
  currencyCode: 'USD',
});

const getSubscriptionData = (customData: PaddleCustomData) =>
  new SubscriptionCreatedEvent({
    event_id: '1',
    notification_id: '1',
    event_type: EventName.SubscriptionCreated,
    occurred_at: new Date().toISOString(),
    data: {
      id: '1',
      status: 'active',
      transaction_id: '1',
      customer_id: '1',
      address_id: '1',
      business_id: null,
      custom_data: customData,
      currency_code: 'USD',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      collection_mode: 'automatic',
      billing_cycle: {
        interval: 'month',
        frequency: 1,
      },
      items: [
        {
          price: {
            id: 'pricingGift',
            product_id: '1',
            name: 'Gift Subscription',
            tax_mode: 'internal',
          },
          status: 'active',
          quantity: 1,
          recurring: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    },
  });

const getTransactionData = (customData: PaddleCustomData) =>
  new TransactionCompletedEvent({
    event_id: '1',
    notification_id: '1',
    event_type: EventName.SubscriptionCreated,
    occurred_at: new Date().toISOString(),
    data: {
      id: '1',
      customer_id: '1',
      address_id: '1',
      business_id: null,
      custom_data: customData,
      currency_code: 'USD',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      collection_mode: 'automatic',
      status: 'completed',
      origin: 'web',
      payments: [],
      items: [],
    },
  });

describe('pricing preview', () => {
  const QUERY = `
    query PricePreviews {
      pricePreviews {
        currencyCode
        items {
          label
          value
          price {
            amount
            formatted
            monthlyAmount
            monthlyFormatted
          }
          currencyCode
          currencySymbol
          extraLabel
          appsId
          duration
          trialPeriod {
            interval
            frequency
          }
        }
      }
    }
  `;

  beforeEach(async () => {
    await ioRedisPool.execute((client) => client.flushall());
  });

  it('should return pricing preview data', async () => {
    loggedUser = 'whp-1';
    const mockPreview = jest.fn().mockResolvedValue(getPricingPreviewData());
    jest
      .spyOn(paddleInstance.pricingPreview, 'preview')
      .mockImplementation(mockPreview);

    const result = await client.query(QUERY);
    expect(result.data.pricePreviews.currencyCode).toBe('USD');
    expect(result.data.pricePreviews.items).toHaveLength(2);
    expect(result.data.pricePreviews.items[0].price.formatted).toBe('$5.00');
    expect(result.data.pricePreviews.items[0].price.monthlyFormatted).toBe(
      '$5.00',
    );
    expect(result.data.pricePreviews.items[1].price.formatted).toBe('$60.00');
    expect(result.data.pricePreviews.items[1].price.monthlyFormatted).toBe(
      '$5.00',
    );
  });

  it('should cache pricing preview data', async () => {
    const getRedisObjectSpy = jest.spyOn(redisFile, 'getRedisObject');

    const setRedisObjectWithExpirySpy = jest.spyOn(
      redisFile,
      'setRedisObjectWithExpiry',
    );

    loggedUser = 'whp-1';
    const mockPreview = jest.fn().mockResolvedValue(getPricingPreviewData());
    jest
      .spyOn(paddleInstance.pricingPreview, 'preview')
      .mockImplementationOnce(mockPreview);

    const result = await client.query(QUERY);

    expect(result.errors).toBeFalsy();

    expect(getRedisObjectSpy).toHaveBeenCalledTimes(1);
    expect(getRedisObjectSpy).toHaveBeenCalledWith(
      'paddle:pricing_preview:5a1afc9a87661f19ef8486f7d83ff8883eb0db40:',
    );

    expect(setRedisObjectWithExpirySpy).toHaveBeenCalledTimes(1);
    expect(setRedisObjectWithExpirySpy).toHaveBeenCalledWith(
      'paddle:pricing_preview:5a1afc9a87661f19ef8486f7d83ff8883eb0db40:',
      expect.any(String),
      3600,
    );

    const result2 = await client.query(QUERY);

    expect(result2.errors).toBeFalsy();

    expect(getRedisObjectSpy).toHaveBeenCalledTimes(2);
    expect(setRedisObjectWithExpirySpy).toHaveBeenCalledTimes(1);

    expect(result).toEqual(result2);
  });
});

describe('plus subscription', () => {
  it('should add a plus subscription to a user', async () => {
    const userId = 'whp-1';
    const user = await con.getRepository(User).findOneByOrFail({ id: userId });
    const isInitiallyPlus = isPlusMember(user.subscriptionFlags?.cycle);
    expect(isInitiallyPlus).toBe(false);

    const data = getSubscriptionData({
      user_id: userId,
    });
    await updateUserSubscription({ data, state: true });

    const updatedUser = await con
      .getRepository(User)
      .findOneByOrFail({ id: userId });
    const isFinallyPlus = isPlusMember(updatedUser.subscriptionFlags?.cycle);
    expect(isFinallyPlus).toBe(true);
    expect(updatedUser.subscriptionFlags?.provider).toEqual(
      SubscriptionProvider.Paddle,
    );
  });
});

describe('gift', () => {
  const logError = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should ignore if gifter user is not valid', async () => {
    jest.spyOn(logger, 'error').mockImplementation(logError);
    const userId = 'whp-2';
    const result = getTransactionData({
      user_id: userId,
      gifter_id: 'whp-10',
    });
    await processGiftedPayment({ event: result });
    expect(logError).toHaveBeenCalled();

    const updatedUser = await con
      .getRepository(User)
      .findOneByOrFail({ id: userId });
    const isFinallyPlus = isPlusMember(updatedUser.subscriptionFlags?.cycle);
    expect(isFinallyPlus).toBe(false);
  });

  it('should ignore if gifter and user is the same', async () => {
    jest.spyOn(logger, 'error').mockImplementation(logError);
    const userId = 'whp-2';
    const user = await con.getRepository(User).findOneByOrFail({ id: userId });
    const isInitiallyPlus = isPlusMember(user.subscriptionFlags?.cycle);
    expect(isInitiallyPlus).toBe(false);

    const result = getTransactionData({
      user_id: userId,
      gifter_id: userId,
    });
    await processGiftedPayment({ event: result });
    expect(logError).toHaveBeenCalled();

    const updatedUser = await con
      .getRepository(User)
      .findOneByOrFail({ id: userId });
    const isFinallyPlus = isPlusMember(updatedUser.subscriptionFlags?.cycle);
    expect(isFinallyPlus).toBe(false);
  });

  it('should ignore if user is already plus', async () => {
    jest.spyOn(logger, 'error').mockImplementation(logError);
    const userId = 'whp-1';
    await con
      .getRepository(User)
      .update(
        { id: userId },
        { subscriptionFlags: { cycle: SubscriptionCycles.Monthly } },
      );
    const user = await con.getRepository(User).findOneByOrFail({ id: userId });
    const isInitiallyPlus = isPlusMember(user.subscriptionFlags?.cycle);
    expect(isInitiallyPlus).toBe(true);

    const result = getTransactionData({
      user_id: user.id,
      gifter_id: 'whp-2',
    });
    await processGiftedPayment({ event: result });
    expect(logError).toHaveBeenCalled();
  });

  it('should gift a subscription to a user', async () => {
    const userId = 'whp-1';
    const user = await con.getRepository(User).findOneByOrFail({ id: 'whp-1' });
    const isInitiallyPlus = isPlusMember(user.subscriptionFlags?.cycle);

    expect(isInitiallyPlus).toBe(false);

    const result = getTransactionData({
      user_id: userId,
      gifter_id: 'whp-2',
    });

    await processGiftedPayment({ event: result });
    const updatedUser = await con
      .getRepository(User)
      .findOneByOrFail({ id: userId });
    const isFinallyPlus = isPlusMember(updatedUser.subscriptionFlags?.cycle);
    expect(isFinallyPlus).toBe(true);
    expect(updatedUser.subscriptionFlags?.gifterId).toBe('whp-2');
    expect(updatedUser.subscriptionFlags?.provider).toEqual(
      SubscriptionProvider.Paddle,
    );
    const expireDate =
      updatedUser.subscriptionFlags?.giftExpirationDate &&
      new Date(updatedUser.subscriptionFlags?.giftExpirationDate);
    expect(expireDate).toBeInstanceOf(Date);
    expect(expireDate?.getFullYear()).toBe(new Date().getFullYear() + 1);
  });

  it('should add showPlusGift flags to recipient when gifted', async () => {
    const userId = 'whp-1';
    const user = await con.getRepository(User).findOneByOrFail({ id: 'whp-1' });

    expect(isPlusMember(user.subscriptionFlags?.cycle)).toBe(false);
    expect(user.flags).toStrictEqual({
      vordr: false,
      trustScore: 1,
    });

    const result = getTransactionData({
      user_id: userId,
      gifter_id: 'whp-2',
    });

    await processGiftedPayment({ event: result });
    const updatedUser = await con
      .getRepository(User)
      .findOneByOrFail({ id: userId });

    expect(isPlusMember(updatedUser.subscriptionFlags?.cycle)).toBe(true);
    expect(updatedUser.flags).toStrictEqual({
      vordr: false,
      trustScore: 1,
      showPlusGift: true,
    });
  });
});
