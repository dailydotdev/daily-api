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
import { processRecruiterPaddleEvent } from '../../../src/common/paddle/recruiter/eventHandler';
import * as paddleCommon from '../../../src/common/paddle';
import {
  recruiterSubscriptionCreated,
  recruiterSubscriptionCanceled,
  recruiterTransactionCompleted,
} from '../../fixture/paddle/subscription';
import * as slackCommon from '../../../src/common/slack';
import { Organization } from '../../../src/entity/Organization';
import { OpportunityJob } from '../../../src/entity/opportunities/OpportunityJob';
import { OpportunityUser } from '../../../src/entity/opportunities/user';
import { OpportunityUserType } from '../../../src/entity/opportunities/types';
import { OpportunityState, OpportunityType } from '@dailydotdev/schema';
import { SubscriptionStatus } from '../../../src/common/plus/subscription';
import { SubscriptionCycles } from '../../../src/paddle';

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
      referenceId: null,
      referenceType: null,
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
        purchaseType: PurchaseType.Cores,
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
      referenceId: null,
      referenceType: null,
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
        purchaseType: PurchaseType.Cores,
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
        purchaseType: PurchaseType.Cores,
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
      referenceId: null,
      referenceType: null,
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
        purchaseType: PurchaseType.Cores,
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
      referenceId: null,
      referenceType: null,
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
      referenceId: null,
      referenceType: null,
      request: {},
      senderId: null,
      status: 0,
      updatedAt: expect.any(Date),
      value: 600,
      valueIncFees: 600,
    });
  });
});

describe('recruiter product', () => {
  const testOrganizationId = '550e8400-e29b-41d4-a716-446655440000';
  const testOpportunityId = '550e8400-e29b-41d4-a716-446655440003';
  const testUserId = 'recruiter-user-1';

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock analytics event logging to avoid external HTTP calls
    jest
      .spyOn(paddleCommon, 'logPaddleAnalyticsEvent')
      .mockResolvedValue(undefined);

    // Mock slack webhook to avoid external HTTP calls
    jest
      .spyOn(slackCommon.webhooks.transactions, 'send')
      .mockResolvedValue({ text: 'ok' });

    // Create test user
    await saveFixtures(con, User, [
      {
        ...usersFixture[0],
        id: testUserId,
      },
    ]);

    // Create test organization without active subscription
    await saveFixtures(con, Organization, [
      {
        id: testOrganizationId,
        name: 'Test Org for Recruiter',
        recruiterSubscriptionFlags: {},
      },
    ]);

    // Create test opportunity in DRAFT state
    await saveFixtures(con, OpportunityJob, [
      {
        id: testOpportunityId,
        type: OpportunityType.JOB,
        state: OpportunityState.DRAFT,
        title: 'Test Opportunity',
        tldr: 'Test opportunity for recruiter subscription',
        organizationId: testOrganizationId,
        content: {},
        meta: {},
        flags: {},
      },
    ]);

    // Create opportunity user (recruiter) relationship
    await saveFixtures(con, OpportunityUser, [
      {
        opportunityId: testOpportunityId,
        userId: testUserId,
        type: OpportunityUserType.Recruiter,
      },
    ]);
  });

  it('subscription created success', async () => {
    await processRecruiterPaddleEvent(recruiterSubscriptionCreated);

    const organization = await con
      .getRepository(Organization)
      .findOneByOrFail({ id: testOrganizationId });

    expect(organization.recruiterSubscriptionFlags).toMatchObject({
      status: SubscriptionStatus.Active,
      subscriptionId: 'sub_01jrec123subscription001',
      cycle: 'monthly',
      provider: 'paddle',
    });
    expect(organization.recruiterSubscriptionFlags?.items).toHaveLength(1);
    expect(organization.recruiterSubscriptionFlags?.items?.[0]).toMatchObject({
      priceId: 'pri_recruiter_monthly',
      quantity: 1,
    });

    const opportunity = await con
      .getRepository(OpportunityJob)
      .findOneByOrFail({ id: testOpportunityId });

    expect(opportunity.state).toBe(OpportunityState.DRAFT);
    expect(opportunity.flags).toMatchObject({
      batchSize: 100,
      plan: 'pri_recruiter_monthly',
      reminders: true,
      showSlack: true,
      showFeedback: true,
    });
  });

  it('subscription canceled success', async () => {
    // Set up organization with active subscription (without going through create flow)
    await con.getRepository(Organization).update(
      { id: testOrganizationId },
      {
        recruiterSubscriptionFlags: {
          status: SubscriptionStatus.Active,
          subscriptionId: 'sub_01jrec123subscription001',
          provider: SubscriptionProvider.Paddle,
          cycle: SubscriptionCycles.Monthly,
          items: [{ priceId: 'pri_recruiter_monthly', quantity: 1 }],
        },
      },
    );

    // Now cancel it
    await processRecruiterPaddleEvent(recruiterSubscriptionCanceled);

    const organization = await con
      .getRepository(Organization)
      .findOneByOrFail({ id: testOrganizationId });

    expect(organization.recruiterSubscriptionFlags?.status).toBe(
      SubscriptionStatus.Cancelled,
    );
    expect(organization.recruiterSubscriptionFlags?.cycle).toBeNull();
    expect(organization.recruiterSubscriptionFlags?.items).toEqual([]);

    const opportunity = await con
      .getRepository(OpportunityJob)
      .findOneByOrFail({ id: testOpportunityId });

    expect(opportunity.state).toBe(OpportunityState.CLOSED);
  });

  it('subscription created throws if billing cycle missing', async () => {
    const eventWithNoBillingCycle = {
      ...recruiterSubscriptionCreated,
      data: {
        ...recruiterSubscriptionCreated.data,
        items: [
          {
            ...recruiterSubscriptionCreated.data.items[0],
            price: {
              ...recruiterSubscriptionCreated.data.items[0].price,
              billingCycle: null,
            },
          },
        ],
      },
    };

    await expect(
      processRecruiterPaddleEvent(
        eventWithNoBillingCycle as unknown as typeof recruiterSubscriptionCreated,
      ),
    ).rejects.toThrow('Invalid input');
  });

  it('subscription created throws if opportunity not found', async () => {
    const eventWithInvalidOpportunity = {
      ...recruiterSubscriptionCreated,
      data: {
        ...recruiterSubscriptionCreated.data,
        customData: {
          ...recruiterSubscriptionCreated.data.customData,
          opportunity_id: '00000000-0000-0000-0000-000000000000',
        },
      },
    };

    await expect(
      processRecruiterPaddleEvent(
        eventWithInvalidOpportunity as typeof recruiterSubscriptionCreated,
      ),
    ).rejects.toThrow();
  });

  it('subscription created throws if organization missing', async () => {
    // Update opportunity to have no organization
    await con
      .getRepository(OpportunityJob)
      .update({ id: testOpportunityId }, { organizationId: null });

    await expect(
      processRecruiterPaddleEvent(recruiterSubscriptionCreated),
    ).rejects.toThrow(
      'Opportunity does not have organization during payment processing',
    );
  });

  it('subscription created throws if organization already has active subscription', async () => {
    // Set organization with active subscription
    await con.getRepository(Organization).update(
      { id: testOrganizationId },
      {
        recruiterSubscriptionFlags: {
          status: SubscriptionStatus.Active,
          subscriptionId: 'existing-sub',
          provider: SubscriptionProvider.Paddle,
          items: [],
        },
      },
    );

    await expect(
      processRecruiterPaddleEvent(recruiterSubscriptionCreated),
    ).rejects.toThrow('Organization already has active recruiter subscription');
  });

  it('subscription created throws if user lacks edit permission', async () => {
    // Remove the OpportunityUser relationship
    await con.getRepository(OpportunityUser).delete({
      opportunityId: testOpportunityId,
      userId: testUserId,
    });

    await expect(
      processRecruiterPaddleEvent(recruiterSubscriptionCreated),
    ).rejects.toThrow('Access denied!');
  });

  it('subscription created throws if multiple items in subscription', async () => {
    const eventWithMultipleItems = {
      ...recruiterSubscriptionCreated,
      data: {
        ...recruiterSubscriptionCreated.data,
        items: [
          ...recruiterSubscriptionCreated.data.items,
          {
            ...recruiterSubscriptionCreated.data.items[0],
            price: {
              ...recruiterSubscriptionCreated.data.items[0].price,
              id: 'pri_recruiter_yearly',
            },
          },
        ],
      },
    };

    await expect(
      processRecruiterPaddleEvent(
        eventWithMultipleItems as typeof recruiterSubscriptionCreated,
      ),
    ).rejects.toThrow('Multiple items in subscription not supported yet');
  });

  it('subscription created throws if price missing', async () => {
    const eventWithNoPrice = {
      ...recruiterSubscriptionCreated,
      data: {
        ...recruiterSubscriptionCreated.data,
        items: [
          {
            ...recruiterSubscriptionCreated.data.items[0],
            price: undefined,
          },
        ],
      },
    };

    await expect(
      processRecruiterPaddleEvent(
        eventWithNoPrice as unknown as typeof recruiterSubscriptionCreated,
      ),
    ).rejects.toThrow('Invalid input');
  });

  it('subscription canceled throws if opportunity not found', async () => {
    const eventWithInvalidOpportunity = {
      ...recruiterSubscriptionCanceled,
      data: {
        ...recruiterSubscriptionCanceled.data,
        customData: {
          ...recruiterSubscriptionCanceled.data.customData,
          opportunity_id: '00000000-0000-0000-0000-000000000000',
        },
      },
    };

    await expect(
      processRecruiterPaddleEvent(
        eventWithInvalidOpportunity as typeof recruiterSubscriptionCanceled,
      ),
    ).rejects.toThrow();
  });

  it('subscription canceled throws if organization missing', async () => {
    // Update opportunity to have no organization
    await con
      .getRepository(OpportunityJob)
      .update({ id: testOpportunityId }, { organizationId: null });

    await expect(
      processRecruiterPaddleEvent(recruiterSubscriptionCanceled),
    ).rejects.toThrow(
      'Opportunity does not have organization during payment processing',
    );
  });

  it('subscription canceled throws if user lacks edit permission', async () => {
    // Remove the OpportunityUser relationship
    await con.getRepository(OpportunityUser).delete({
      opportunityId: testOpportunityId,
      userId: testUserId,
    });

    await expect(
      processRecruiterPaddleEvent(recruiterSubscriptionCanceled),
    ).rejects.toThrow('Access denied!');
  });

  it('transaction completed sends slack notification', async () => {
    const slackSpy = jest.spyOn(slackCommon.webhooks.transactions, 'send');

    await processRecruiterPaddleEvent(recruiterTransactionCompleted);

    expect(slackSpy).toHaveBeenCalledTimes(1);
    expect(slackSpy).toHaveBeenCalledWith({
      blocks: expect.arrayContaining([
        expect.objectContaining({
          type: 'header',
          text: expect.objectContaining({
            text: 'New job subscription :tears-of-joy-office: :paddle:',
          }),
        }),
      ]),
    });
  });
});
