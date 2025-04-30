import type {
  TransactionCreatedEvent,
  TransactionUpdatedEvent,
  TransactionPaidEvent,
  TransactionCompletedEvent,
  TransactionPaymentFailedEvent,
} from '@paddle/paddle-node-sdk';

export const coresTransactionCreated = {
  eventId: 'evt_01jrwyswtzbnh5rayevc0jc31r',
  notificationId: 'ntf_01jrwyswyx68wd7dkh949bw9gb',
  eventType: 'transaction.created',
  occurredAt: '2025-04-15T14:49:12.287686Z',
  data: {
    id: 'txn_01jrwyswhztmre55nbd7d09qvp',
    status: 'draft',
    customerId: 'ctm_01jqy42s56qwrj14pfmaeav2f2',
    customData: { user_id: 'whcp-1' },
    discountId: null,
    items: [
      {
        price: {
          id: 'pri_01jp2q71dgtxzsv89ht75zhffj',
          productId: 'pro_01jn6djzggt2cwharv1r3hv9as',
          description: '600 Cores',
          type: 'standard',
          name: '600 Cores',
          unitPrice: { amount: '600', currencyCode: 'USD' },
          unitPriceOverrides: [],
          quantity: { minimum: 1, maximum: 999999 },
          status: 'active',
          createdAt: '2025-03-11T13:44:55.47215Z',
          updatedAt: '2025-03-13T09:58:04.398968Z',
          customData: { cores: '600' },
          importMeta: null,
        },
        quantity: 1,
        proration: null,
      },
    ],
    payments: [],
    createdAt: '2025-04-15T14:49:12.070563411Z',
    updatedAt: '2025-04-15T14:49:12.070563411Z',
  },
} as unknown as TransactionCreatedEvent;

export const coresTransactionUpdated = {
  eventId: 'evt_01jrwysya2p2n5y3rz65hqegrs',
  notificationId: 'ntf_01jrwysydv6epcxjp27re0544x',
  eventType: 'transaction.updated',
  occurredAt: '2025-04-15T14:49:13.794521Z',
  data: {
    id: 'txn_01jrwyswhztmre55nbd7d09qvp',
    status: 'ready',
    customerId: 'ctm_01jqy42s56qwrj14pfmaeav2f2',
    customData: { user_id: 'whcp-1' },
    items: [
      {
        price: {
          id: 'pri_01jp2q71dgtxzsv89ht75zhffj',
          productId: 'pro_01jn6djzggt2cwharv1r3hv9as',
          description: '300 Cores',
          type: 'standard',
          name: '300 Cores',
          unitPrice: { amount: '300', currencyCode: 'USD' },
          unitPriceOverrides: [],
          quantity: { minimum: 1, maximum: 999999 },
          status: 'active',
          createdAt: '2025-03-11T13:44:55.47215Z',
          updatedAt: '2025-03-13T09:58:04.398968Z',
          customData: { cores: '300' },
          importMeta: null,
        },
        quantity: 1,
        proration: null,
      },
    ],
    payments: [],
    createdAt: '2025-04-15T14:49:12.070563Z',
    updatedAt: '2025-04-15T14:49:13.347383947Z',
  },
} as unknown as TransactionUpdatedEvent;

export const coresTransactionPaid = {
  eventId: 'evt_01jrwyt9502nck9tc28g3geqb5',
  notificationId: 'ntf_01jrwyt98tqc4mw12dgmdfcetp',
  eventType: 'transaction.paid',
  occurredAt: '2025-04-15T14:49:24.896831Z',
  data: {
    id: 'txn_01jrwyswhztmre55nbd7d09qvp',
    status: 'paid',
    customerId: 'ctm_01jqy42s56qwrj14pfmaeav2f2',
    customData: { user_id: 'whcp-1' },
    items: [
      {
        price: {
          id: 'pri_01jp2q71dgtxzsv89ht75zhffj',
          productId: 'pro_01jn6djzggt2cwharv1r3hv9as',
          description: '600 Cores',
          type: 'standard',
          name: '600 Cores',
          unitPrice: { amount: '600', currencyCode: 'USD' },
          unitPriceOverrides: [],
          quantity: { minimum: 1, maximum: 999999 },
          status: 'active',
          createdAt: '2025-03-11T13:44:55.47215Z',
          updatedAt: '2025-03-13T09:58:04.398968Z',
          customData: { cores: '600' },
          importMeta: null,
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
    createdAt: '2025-04-15T14:49:12.070563Z',
    updatedAt: '2025-04-15T14:49:13.347383947Z',
  },
} as unknown as TransactionPaidEvent;

export const coresTransactionCompleted = {
  eventId: 'evt_01jrwytba97zw92zysyfsqnwjz',
  notificationId: 'ntf_01jrwytbfmamtjvgxs8e2swysg',
  eventType: 'transaction.completed',
  occurredAt: '2025-04-15T14:49:27.113919Z',
  data: {
    id: 'txn_01jrwyswhztmre55nbd7d09qvp',
    status: 'completed',
    customerId: 'ctm_01jqy42s56qwrj14pfmaeav2f2',
    customData: { user_id: 'whcp-1' },
    items: [
      {
        price: {
          id: 'pri_01jp2q71dgtxzsv89ht75zhffj',
          productId: 'pro_01jn6djzggt2cwharv1r3hv9as',
          description: '600 Cores',
          type: 'standard',
          name: '600 Cores',
          unitPrice: { amount: '600', currencyCode: 'USD' },
          unitPriceOverrides: [],
          quantity: { minimum: 1, maximum: 999999 },
          status: 'active',
          createdAt: '2025-03-11T13:44:55.47215Z',
          updatedAt: '2025-03-13T09:58:04.398968Z',
          customData: { cores: '600' },
          importMeta: null,
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
    createdAt: '2025-04-15T14:49:12.070563Z',
    updatedAt: '2025-04-15T14:49:13.347383947Z',
  },
} as unknown as TransactionCompletedEvent;

export const coresTransactionPaymentFailed = {
  eventId: 'evt_01jrwyt95f3ew6933jwxs1e915',
  notificationId: 'ntf_01jrwyt9b53fqfmc9jznncyxc9',
  eventType: 'transaction.payment_failed',
  occurredAt: '2025-04-15T14:49:24.911393Z',
  data: {
    id: 'txn_01jrwyswhztmre55nbd7d09qvp',
    status: 'failed',
    customerId: 'ctm_01jqy42s56qwrj14pfmaeav2f2',
    customData: { user_id: 'whcp-1' },
    items: [
      {
        price: {
          id: 'pri_01jp2q71dgtxzsv89ht75zhffj',
          productId: 'pro_01jn6djzggt2cwharv1r3hv9as',
          description: '600 Cores',
          type: 'standard',
          name: '600 Cores',
          unitPrice: { amount: '600', currencyCode: 'USD' },
          unitPriceOverrides: [],
          quantity: { minimum: 1, maximum: 999999 },
          status: 'active',
          createdAt: '2025-03-11T13:44:55.47215Z',
          updatedAt: '2025-03-13T09:58:04.398968Z',
          customData: { cores: '600' },
          importMeta: null,
        },
        quantity: 1,
      },
    ],
    payments: [
      {
        paymentAttemptId: '526c8c63-0d03-4bbb-85d4-1afeb1f5efed',
        status: 'failed',
        errorCode: 'declined',
      },
    ],
    createdAt: '2025-04-15T14:49:12.070563Z',
    updatedAt: '2025-04-15T14:49:13.347383947Z',
  },
} as unknown as TransactionPaymentFailedEvent;
