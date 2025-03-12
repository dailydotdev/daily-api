import { transactionBalanceLogWorker as worker } from '../../src/workers/transactionBalanceLog';

import { typedWorkers } from '../../src/workers';
import {
  Currency,
  TransferResponse,
  TransferStatus,
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
    const message = new TransferResponse({
      idempotencyKey: 'test-transaction-id',
      status: TransferStatus.SUCCESS,
      timestamp: Date.now(),
      results: [
        {
          id: 'test-transfer-id',
          senderId: 'system',
          receiverId: 'test-user-id',
          currency: Currency.CORES,
          senderBalance: {
            newBalance: -42,
            previousBalance: 0,
            changeAmount: -42,
          },
          receiverBalance: {
            newBalance: 42,
            previousBalance: 0,
            changeAmount: 42,
          },
          transferType: TransferType.TRANSFER,
          description: 'test transaction',
        },
      ],
    });

    await expectSuccessfulTypedBackground(worker, message);
  });
});
