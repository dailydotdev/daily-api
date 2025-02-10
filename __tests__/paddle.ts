import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { saveFixtures } from './helpers';
import { User } from '../src/entity';
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

let app: FastifyInstance;
let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
  app = await appFunc();
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
            description: 'Gift Subscription',
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
    expect(logError).toHaveBeenCalled();
    await processGiftedPayment({ event: result });

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
    expect(logError).toHaveBeenCalled();
    await processGiftedPayment({ event: result });

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
    expect(logError).toHaveBeenCalled();
    await processGiftedPayment({ event: result });
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
