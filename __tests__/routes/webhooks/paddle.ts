import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import {
  createMockNjordErrorTransport,
  createMockNjordTransport,
  saveFixtures,
} from '../../helpers';
import { PurchaseType, SubscriptionProvider } from '../../../src/common/plus';
import { User } from '../../../src/entity';
import { usersFixture } from '../../fixture';

import {
  coresTransactionCreated,
  coresTransactionUpdated,
  coresTransactionPaid,
  coresTransactionCompleted,
  coresTransactionPaymentFailed,
} from '../../fixture/paddle/transaction';
import {
  getPaddleTransactionData,
  getTransactionForProviderId,
  paddleInstance,
} from '../../../src/common/paddle';
import { logger } from '../../../src/logger';
import { CoresRole } from '../../../src/types';
import * as njordCommon from '../../../src/common/njord';
import { createClient } from '@connectrpc/connect';
import { Credits, TransferStatus } from '@dailydotdev/schema';
import {
  processCoresTransactionCompleted,
  processCoresTransactionCreated,
  processCoresTransactionPaid,
  processCoresTransactionPaymentFailed,
  processCoresTransactionUpdated,
} from '../../../src/common/paddle/cores/processing';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('cores product', () => {
  beforeEach(async () => {
    jest.clearAllMocks();

    await saveFixtures(
      con,
      User,
      [...usersFixture].map((user) => ({
        ...user,
        id: `whcp-${user.id}`,
        coresRole: CoresRole.Creator,
      })),
    );

    const mockTransport = createMockNjordTransport();
    jest
      .spyOn(njordCommon, 'getNjordClient')
      .mockImplementation(() => createClient(Credits, mockTransport));

    jest
      .spyOn(paddleInstance.transactions, 'update')
      .mockImplementationOnce(jest.fn().mockResolvedValue({}));
  });

  it('purchase success', async () => {
    const purchaseCoresSpy = jest.spyOn(njordCommon, 'purchaseCores');

    await processCoresTransactionCreated({
      event: coresTransactionCreated,
    });

    let userTransaction = await getTransactionForProviderId({
      con,
      providerId: coresTransactionCreated.data.id,
    });
    expect(userTransaction!.status).toBe(201);

    await processCoresTransactionUpdated({
      event: {
        ...coresTransactionUpdated,
        data: {
          ...coresTransactionUpdated.data,
          updatedAt: new Date(
            userTransaction!.updatedAt.getTime() + 1000,
          ).toISOString(),
        },
      },
    });

    userTransaction = await getTransactionForProviderId({
      con,
      providerId: coresTransactionCreated.data.id,
    });
    expect(userTransaction!.status).toBe(201);

    await processCoresTransactionPaid({
      event: coresTransactionPaid,
    });

    userTransaction = await getTransactionForProviderId({
      con,
      providerId: coresTransactionCreated.data.id,
    });
    expect(userTransaction!.status).toBe(202);

    await processCoresTransactionCompleted({
      event: coresTransactionCompleted,
    });

    expect(purchaseCoresSpy).toHaveBeenCalledTimes(1);

    userTransaction = await getTransactionForProviderId({
      con,
      providerId: coresTransactionCreated.data.id,
    });
    expect(userTransaction!.status).toBe(0);
  });

  it('purchase failure', async () => {
    await processCoresTransactionCreated({
      event: coresTransactionCreated,
    });

    let userTransaction = await getTransactionForProviderId({
      con,
      providerId: coresTransactionCreated.data.id,
    });
    expect(userTransaction!.status).toBe(201);

    await processCoresTransactionUpdated({
      event: {
        ...coresTransactionUpdated,
        data: {
          ...coresTransactionUpdated.data,
          updatedAt: new Date(
            userTransaction!.updatedAt.getTime() + 1000,
          ).toISOString(),
        },
      },
    });

    userTransaction = await getTransactionForProviderId({
      con,
      providerId: coresTransactionCreated.data.id,
    });
    expect(userTransaction!.status).toBe(201);

    await processCoresTransactionPaid({
      event: coresTransactionPaid,
    });

    userTransaction = await getTransactionForProviderId({
      con,
      providerId: coresTransactionCreated.data.id,
    });
    expect(userTransaction!.status).toBe(202);

    await processCoresTransactionPaymentFailed({
      event: coresTransactionPaymentFailed,
    });

    userTransaction = await getTransactionForProviderId({
      con,
      providerId: coresTransactionCreated.data.id,
    });
    expect(userTransaction!.status).toBe(501);
  });

  it('purchase success after failure', async () => {
    const purchaseCoresSpy = jest.spyOn(njordCommon, 'purchaseCores');

    await processCoresTransactionCreated({
      event: coresTransactionCreated,
    });

    let userTransaction = await getTransactionForProviderId({
      con,
      providerId: coresTransactionCreated.data.id,
    });
    expect(userTransaction!.status).toBe(201);

    await processCoresTransactionUpdated({
      event: {
        ...coresTransactionUpdated,
        data: {
          ...coresTransactionUpdated.data,
          updatedAt: new Date(
            userTransaction!.updatedAt.getTime() + 1000,
          ).toISOString(),
        },
      },
    });

    userTransaction = await getTransactionForProviderId({
      con,
      providerId: coresTransactionCreated.data.id,
    });
    expect(userTransaction!.status).toBe(201);

    await processCoresTransactionPaid({
      event: coresTransactionPaid,
    });

    userTransaction = await getTransactionForProviderId({
      con,
      providerId: coresTransactionCreated.data.id,
    });
    expect(userTransaction!.status).toBe(202);

    await processCoresTransactionPaymentFailed({
      event: coresTransactionPaymentFailed,
    });

    expect(purchaseCoresSpy).toHaveBeenCalledTimes(0);

    userTransaction = await getTransactionForProviderId({
      con,
      providerId: coresTransactionCreated.data.id,
    });
    expect(userTransaction!.status).toBe(501);

    await processCoresTransactionCompleted({
      event: coresTransactionCompleted,
    });

    expect(purchaseCoresSpy).toHaveBeenCalledTimes(1);

    userTransaction = await getTransactionForProviderId({
      con,
      providerId: coresTransactionCreated.data.id,
    });
    expect(userTransaction!.status).toBe(0);
  });

  it('transaction created event', async () => {
    await processCoresTransactionCreated({ event: coresTransactionCreated });

    const userTransaction = await getTransactionForProviderId({
      con,
      providerId: coresTransactionCreated.data.id,
    });

    expect(userTransaction).not.toBeNull();

    expect(userTransaction).toEqual({
      id: expect.any(String),
      createdAt: expect.any(Date),
      fee: 0,
      flags: {
        providerId: 'txn_01jrwyswhztmre55nbd7d09qvp',
      },
      processor: 'paddle',
      productId: null,
      receiverId: 'whcp-1',
      request: {},
      senderId: null,
      status: 201,
      updatedAt: expect.any(Date),
      value: 600,
      valueIncFees: 600,
    });
  });

  it('transaction already created should skip', async () => {
    await processCoresTransactionCreated({ event: coresTransactionCreated });

    const userTransaction = await getTransactionForProviderId({
      con,
      providerId: coresTransactionCreated.data.id,
    });

    expect(userTransaction).not.toBeNull();

    const warnSpy = jest.spyOn(logger, 'warn');

    await processCoresTransactionCreated({ event: coresTransactionCreated });

    expect(warnSpy).toHaveBeenCalledWith(
      {
        eventType: coresTransactionCreated.eventType,
        provider: SubscriptionProvider.Paddle,
        processor: PurchaseType.Cores,
        currentStatus: userTransaction!.status,
        data: getPaddleTransactionData({ event: coresTransactionCreated }),
      },
      'Transaction already exists',
    );
  });

  it('transaction updated event', async () => {
    await processCoresTransactionUpdated({ event: coresTransactionUpdated });

    const userTransaction = await getTransactionForProviderId({
      con,
      providerId: coresTransactionCreated.data.id,
    });

    expect(userTransaction).not.toBeNull();

    expect(userTransaction).toEqual({
      id: expect.any(String),
      createdAt: expect.any(Date),
      fee: 0,
      flags: {
        providerId: 'txn_01jrwyswhztmre55nbd7d09qvp',
      },
      processor: 'paddle',
      productId: null,
      receiverId: 'whcp-1',
      request: {},
      senderId: null,
      status: 201,
      updatedAt: expect.any(Date),
      value: 300,
      valueIncFees: 300,
    });
  });

  it('transaction updated product change', async () => {
    await processCoresTransactionCreated({ event: coresTransactionCreated });

    let userTransaction = await getTransactionForProviderId({
      con,
      providerId: coresTransactionCreated.data.id,
    });

    expect(userTransaction).not.toBeNull();
    expect(userTransaction!.value).toEqual(600);
    expect(userTransaction!.valueIncFees).toEqual(600);

    expect(userTransaction!.flags.providerId).toEqual(
      'txn_01jrwyswhztmre55nbd7d09qvp',
    );

    const updatedAt = new Date(userTransaction!.createdAt.getTime() + 1000);

    await processCoresTransactionUpdated({
      event: {
        ...coresTransactionUpdated,
        data: {
          ...coresTransactionUpdated.data,
          updatedAt: updatedAt.toISOString(),
        },
      },
    });

    userTransaction = await getTransactionForProviderId({
      con,
      providerId: coresTransactionUpdated.data.id,
    });

    expect(userTransaction).not.toBeNull();
    expect(userTransaction!.value).toEqual(300);
    expect(userTransaction!.valueIncFees).toEqual(300);

    expect(userTransaction!.flags.providerId).toEqual(
      'txn_01jrwyswhztmre55nbd7d09qvp',
    );
  });

  it('transaction already updated should skip', async () => {
    await processCoresTransactionCreated({ event: coresTransactionCreated });

    const userTransaction = await getTransactionForProviderId({
      con,
      providerId: coresTransactionCreated.data.id,
    });

    expect(userTransaction).not.toBeNull();

    const warnSpy = jest.spyOn(logger, 'warn');

    await processCoresTransactionUpdated({ event: coresTransactionUpdated });

    expect(warnSpy).toHaveBeenCalledWith(
      {
        eventType: coresTransactionUpdated.eventType,
        provider: SubscriptionProvider.Paddle,
        processor: PurchaseType.Cores,
        currentStatus: userTransaction!.status,
        data: getPaddleTransactionData({ event: coresTransactionUpdated }),
      },
      'Transaction already updated',
    );
  });

  it('transaction updated skip dedicated status', async () => {
    const warnSpy = jest.spyOn(logger, 'warn');

    await processCoresTransactionUpdated({
      event: {
        ...coresTransactionUpdated,
        data: {
          ...coresTransactionUpdated.data,
          status: 'completed',
        },
      },
    });

    expect(warnSpy).toHaveBeenCalledWith(
      {
        eventType: coresTransactionUpdated.eventType,
        provider: SubscriptionProvider.Paddle,
        processor: PurchaseType.Cores,
        currentStatus: 'unknown',
        data: getPaddleTransactionData({ event: coresTransactionUpdated }),
      },
      'Transaction update skipped',
    );
  });

  it('transaction paid event', async () => {
    const warnSpy = jest.spyOn(logger, 'warn');

    await processCoresTransactionPaid({ event: coresTransactionPaid });

    const userTransaction = await getTransactionForProviderId({
      con,
      providerId: coresTransactionPaid.data.id,
    });

    expect(userTransaction).not.toBeNull();
    expect(userTransaction!.status).toEqual(202);
    expect(userTransaction!.value).toEqual(600);

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('transaction completed event', async () => {
    const purchaseCoresSpy = jest.spyOn(njordCommon, 'purchaseCores');

    await processCoresTransactionCompleted({
      event: coresTransactionCompleted,
    });

    expect(purchaseCoresSpy).toHaveBeenCalledTimes(1);

    const userTransaction = await getTransactionForProviderId({
      con,
      providerId: coresTransactionCompleted.data.id,
    });

    expect(userTransaction).not.toBeNull();

    expect(userTransaction).toEqual({
      id: expect.any(String),
      createdAt: expect.any(Date),
      fee: 0,
      flags: {
        providerId: 'txn_01jrwyswhztmre55nbd7d09qvp',
      },
      processor: 'paddle',
      productId: null,
      receiverId: 'whcp-1',
      request: {},
      senderId: null,
      status: 0,
      updatedAt: expect.any(Date),
      value: 600,
      valueIncFees: 600,
    });
  });

  it('transaction completed throw if user coresRole is none', async () => {
    await con.getRepository(User).update(
      { id: 'whcp-1' },
      {
        coresRole: CoresRole.None,
      },
    );

    await expect(() =>
      processCoresTransactionCompleted({ event: coresTransactionCompleted }),
    ).rejects.toThrow('User does not have access to cores purchase');
  });

  it('transaction completed throw if user coresRole is readonly', async () => {
    await con.getRepository(User).update(
      { id: 'whcp-1' },
      {
        coresRole: CoresRole.ReadOnly,
      },
    );

    await expect(() =>
      processCoresTransactionCompleted({ event: coresTransactionCompleted }),
    ).rejects.toThrow('User does not have access to cores purchase');
  });

  it('transaction completed throw if user id mismatch', async () => {
    await processCoresTransactionCreated({ event: coresTransactionCreated });

    await expect(() =>
      processCoresTransactionCompleted({
        event: {
          ...coresTransactionCompleted,
          data: {
            ...coresTransactionCompleted.data,
            customData: {
              ...coresTransactionCompleted.data.customData,
              user_id: 'whcp-2',
            },
          },
        },
      }),
    ).rejects.toThrow('Transaction receiver does not match user ID');
  });

  it('transaction completed throw if value mismatch', async () => {
    await processCoresTransactionCompleted({
      event: coresTransactionCompleted,
    });

    await expect(() =>
      processCoresTransactionUpdated({
        event: {
          ...coresTransactionUpdated,
          data: {
            ...coresTransactionUpdated.data,
            updatedAt: new Date(Date.now() + 1000).toISOString(),
          },
        },
      }),
    ).rejects.toThrow('Transaction value changed after success');
  });

  it('transaction payment failed event', async () => {
    await processCoresTransactionCreated({
      event: coresTransactionCreated,
    });

    const warnSpy = jest.spyOn(logger, 'warn');

    await processCoresTransactionPaymentFailed({
      event: coresTransactionPaymentFailed,
    });

    const userTransaction = await getTransactionForProviderId({
      con,
      providerId: coresTransactionPaymentFailed.data.id,
    });

    expect(userTransaction).not.toBeNull();
    expect(userTransaction!.status).toEqual(501);
    expect(userTransaction!.flags.error).toContain('Payment failed: declined');

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('transaction payment failed with invalid status', async () => {
    await processCoresTransactionCompleted({
      event: coresTransactionCompleted,
    });

    const warnSpy = jest.spyOn(logger, 'warn');

    await processCoresTransactionPaymentFailed({
      event: coresTransactionPaymentFailed,
    });

    expect(warnSpy).toHaveBeenCalledWith(
      {
        eventType: coresTransactionPaymentFailed.eventType,
        provider: SubscriptionProvider.Paddle,
        processor: PurchaseType.Cores,
        currentStatus: 0,
        nextStatus: 501,
        data: getPaddleTransactionData({
          event: coresTransactionPaymentFailed,
        }),
      },
      'Transaction with invalid status',
    );
  });

  it('transaction payment failed throws if no transaction exists', async () => {
    await expect(() =>
      processCoresTransactionPaymentFailed({
        event: coresTransactionPaymentFailed,
      }),
    ).rejects.toThrow('Transaction not found');
  });

  it('transaction paid after error', async () => {
    await processCoresTransactionCreated({
      event: coresTransactionCreated,
    });

    let userTransaction = await getTransactionForProviderId({
      con,
      providerId: coresTransactionCreated.data.id,
    });
    expect(userTransaction!.status).toBe(201);

    await processCoresTransactionPaymentFailed({
      event: coresTransactionPaymentFailed,
    });

    userTransaction = await getTransactionForProviderId({
      con,
      providerId: coresTransactionCreated.data.id,
    });
    expect(userTransaction!.status).toBe(501);
    expect(userTransaction!.flags.error).toContain('Payment failed: declined');

    await processCoresTransactionPaid({
      event: coresTransactionPaid,
    });

    userTransaction = await getTransactionForProviderId({
      con,
      providerId: coresTransactionCreated.data.id,
    });
    expect(userTransaction!.status).toBe(202);
    expect(userTransaction!.flags.error).toBeNull();
  });

  it('transaction njord error on completed', async () => {
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

    await processCoresTransactionCompleted({
      event: coresTransactionCompleted,
    });

    expect(purchaseCoresSpy).toHaveBeenCalledTimes(1);

    const userTransaction = await getTransactionForProviderId({
      con,
      providerId: coresTransactionCompleted.data.id,
    });

    expect(userTransaction).not.toBeNull();

    expect(userTransaction).toEqual({
      id: expect.any(String),
      createdAt: expect.any(Date),
      fee: 0,
      flags: {
        providerId: 'txn_01jrwyswhztmre55nbd7d09qvp',
        error: 'Insufficient Cores balance.',
      },
      processor: 'paddle',
      productId: null,
      receiverId: 'whcp-1',
      request: {},
      senderId: null,
      status: 1,
      updatedAt: expect.any(Date),
      value: 600,
      valueIncFees: 600,
    });
  });

  it('transaction skip njord if paddle test discount id', async () => {
    const purchaseCoresSpy = jest.spyOn(njordCommon, 'purchaseCores');

    await processCoresTransactionCompleted({
      event: {
        ...coresTransactionCompleted,
        data: {
          ...coresTransactionCompleted.data,
          discountId: 'dsc_test',
        },
      },
    });

    expect(purchaseCoresSpy).toHaveBeenCalledTimes(0);

    const userTransaction = await getTransactionForProviderId({
      con,
      providerId: coresTransactionCompleted.data.id,
    });

    expect(userTransaction).not.toBeNull();

    expect(userTransaction).toEqual({
      id: expect.any(String),
      createdAt: expect.any(Date),
      fee: 0,
      flags: {
        providerId: 'txn_01jrwyswhztmre55nbd7d09qvp',
        note: 'NJORD_SKIPPED_FOR_TEST_DISCOUNT',
      },
      processor: 'paddle',
      productId: null,
      receiverId: 'whcp-1',
      request: {},
      senderId: null,
      status: 0,
      updatedAt: expect.any(Date),
      value: 600,
      valueIncFees: 600,
    });
  });
});
