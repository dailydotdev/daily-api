import { transactionBalanceLogWorker as worker } from '../../src/workers/transactionBalanceLog';

import { typedWorkers } from '../../src/workers';

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
});
