import type {
  SubscriptionCreatedEvent,
  SubscriptionCanceledEvent,
  TransactionCompletedEvent,
} from '@paddle/paddle-node-sdk';

export const recruiterSubscriptionCreated = {
  eventId: 'evt_01jrec123subscription001',
  notificationId: 'ntf_01jrec123subscription001',
  eventType: 'subscription.created',
  occurredAt: '2025-04-15T14:49:12.287686Z',
  data: {
    id: 'sub_01jrec123subscription001',
    status: 'active',
    customerId: 'ctm_01jqy42s56qwrj14pfmaeav2f2',
    customData: {
      user_id: 'recruiter-user-1',
      opportunity_id: '550e8400-e29b-41d4-a716-446655440003',
    },
    items: [
      {
        price: {
          id: 'pri_recruiter_monthly',
          productId: 'pro_recruiter',
          description: 'Recruiter Monthly',
          type: 'standard',
          name: 'Recruiter Monthly',
          billingCycle: {
            interval: 'month',
            frequency: 1,
          },
          unitPrice: { amount: '9900', currencyCode: 'USD' },
          customData: {
            batch_size: '100',
            reminders: 'true',
            show_slack: 'true',
          },
        },
        quantity: 1,
        status: 'active',
      },
    ],
    billingCycle: {
      interval: 'month',
      frequency: 1,
    },
    startedAt: '2025-04-15T14:49:12.070563Z',
    createdAt: '2025-04-15T14:49:12.070563411Z',
    updatedAt: '2025-04-15T14:49:12.070563411Z',
  },
} as unknown as SubscriptionCreatedEvent;

export const recruiterSubscriptionCanceled = {
  eventId: 'evt_01jrec123subscription002',
  notificationId: 'ntf_01jrec123subscription002',
  eventType: 'subscription.canceled',
  occurredAt: '2025-04-15T15:00:00.000000Z',
  data: {
    id: 'sub_01jrec123subscription001',
    status: 'canceled',
    customerId: 'ctm_01jqy42s56qwrj14pfmaeav2f2',
    customData: {
      user_id: 'recruiter-user-1',
      opportunity_id: '550e8400-e29b-41d4-a716-446655440003',
    },
    items: [
      {
        price: {
          id: 'pri_recruiter_monthly',
          productId: 'pro_recruiter',
          description: 'Recruiter Monthly',
          type: 'standard',
          name: 'Recruiter Monthly',
          billingCycle: {
            interval: 'month',
            frequency: 1,
          },
          unitPrice: { amount: '9900', currencyCode: 'USD' },
          customData: {
            batch_size: '100',
            reminders: 'true',
            show_slack: 'true',
          },
        },
        quantity: 1,
        status: 'canceled',
      },
    ],
    billingCycle: {
      interval: 'month',
      frequency: 1,
    },
    canceledAt: '2025-04-15T15:00:00.000000Z',
    createdAt: '2025-04-15T14:49:12.070563411Z',
    updatedAt: '2025-04-15T15:00:00.000000Z',
  },
} as unknown as SubscriptionCanceledEvent;

export const recruiterTransactionCompleted = {
  eventId: 'evt_01jrec123transaction001',
  notificationId: 'ntf_01jrec123transaction001',
  eventType: 'transaction.completed',
  occurredAt: '2025-04-15T14:50:00.000000Z',
  data: {
    id: 'txn_01jrec123transaction001',
    status: 'completed',
    customerId: 'ctm_01jqy42s56qwrj14pfmaeav2f2',
    subscriptionId: 'sub_01jrec123subscription001',
    customData: {
      user_id: 'recruiter-user-1',
      opportunity_id: '550e8400-e29b-41d4-a716-446655440003',
    },
    items: [
      {
        price: {
          id: 'pri_recruiter_monthly',
          productId: 'pro_recruiter',
          description: 'Recruiter Monthly',
          type: 'standard',
          name: 'Recruiter Monthly',
          unitPrice: { amount: '9900', currencyCode: 'USD' },
        },
        quantity: 1,
      },
    ],
    payments: [
      {
        paymentAttemptId: '526c8c63-0d03-4bbb-85d4-1afeb1f5efed',
        status: 'captured',
      },
    ],
    origin: 'subscription_charge',
    currencyCode: 'USD',
    details: {
      totals: {
        total: '9900',
      },
    },
    createdAt: '2025-04-15T14:49:12.070563Z',
    updatedAt: '2025-04-15T14:50:00.000000Z',
  },
} as unknown as TransactionCompletedEvent;
