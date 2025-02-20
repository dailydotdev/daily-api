import { transactionBalanceLogWorker as worker } from '../../src/workers/transactionBalanceLog';

import { typedWorkers } from '../../src/workers';
import {
  Currency,
  TransactionLogEntry,
  TransferType,
} from '@dailydotdev/schema';
import { expectSuccessfulTypedBackground } from '../helpers';

beforeAll(async () => {
  jest.clearAllMocks();
});

describe('transactionBalanceLog worker', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
  });

  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should log transaction', async () => {
    const message = new TransactionLogEntry({
      transactionId: 'test-transaction-id',
      userId: 'test-user-id',
      currency: Currency.CORES,
      amount: 42,
      previousBalance: 0,
      currentBalance: 42,
      transferType: TransferType.TRANSFER,
      description: 'test transaction',
      timestamp: Date.now(),
    });

    await expectSuccessfulTypedBackground(worker, message);
  });
});
