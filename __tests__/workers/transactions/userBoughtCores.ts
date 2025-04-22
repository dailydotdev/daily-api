import { expectSuccessfulTypedBackground, saveFixtures } from '../../helpers';
import { userBoughtCores as worker } from '../../../src/workers/transactions/userBoughtCores';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { User } from '../../../src/entity';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
} from '../../../src/entity/user/UserTransaction';
import { usersFixture } from '../../fixture/user';
import { typedWorkers } from '../../../src/workers';
import {
  CioTransactionalMessageTemplateId,
  ghostUser,
  sendEmail,
} from '../../../src/common';
import type { ChangeObject } from '../../../src/types';

jest.mock('../../../src/common', () => ({
  ...(jest.requireActual('../../../src/common') as Record<string, unknown>),
  sendEmail: jest.fn(),
}));

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

describe('userBoughtCores worker', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    await saveFixtures(con, User, usersFixture);
  });

  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );
    expect(registeredWorker).toBeDefined();
  });

  it('should do nothing if transaction not found', async () => {
    const now = Date.now();
    await expectSuccessfulTypedBackground(worker, {
      transaction: {
        id: '87b79108-d258-42d2-b38a-4a02974746cc',
        productId: null,
        status: UserTransactionStatus.Success,
        createdAt: now,
        updatedAt: now,
        receiverId: '1',
        senderId: null,
        value: 100,
        valueIncFees: 100,
        fee: 0,
        request: '{}',
        flags: '{}',
        processor: UserTransactionProcessor.Paddle,
      },
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('should do nothing if processor is not supported', async () => {
    const tx = con.getRepository(UserTransaction).create({
      processor: UserTransactionProcessor.Njord,
      receiverId: '1',
      status: UserTransactionStatus.Success,
      value: 100,
      valueIncFees: 100,
      fee: 0,
      request: {},
      flags: {},
      productId: null,
    });
    const transaction = await con.getRepository(UserTransaction).save(tx);

    await expectSuccessfulTypedBackground(worker, {
      transaction: transaction as unknown as ChangeObject<UserTransaction>,
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('should do nothing if transaction status is not success', async () => {
    const tx = con.getRepository(UserTransaction).create({
      processor: UserTransactionProcessor.Paddle,
      receiverId: '1',
      status: UserTransactionStatus.Error,
      value: 100,
      valueIncFees: 100,
      fee: 0,
      request: {},
      flags: {},
      productId: null,
    });
    const transaction = await con.getRepository(UserTransaction).save(tx);

    await expectSuccessfulTypedBackground(worker, {
      transaction: transaction as unknown as ChangeObject<UserTransaction>,
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('should do nothing if email was already sent', async () => {
    const tx = con.getRepository(UserTransaction).create({
      processor: UserTransactionProcessor.Paddle,
      receiverId: '1',
      status: UserTransactionStatus.Success,
      value: 100,
      valueIncFees: 100,
      fee: 0,
      request: {},
      flags: { emailSent: true },
      productId: null,
    });
    const transaction = await con.getRepository(UserTransaction).save(tx);

    await expectSuccessfulTypedBackground(worker, {
      transaction: transaction as unknown as ChangeObject<UserTransaction>,
    });

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('should send email for successful Paddle transaction', async () => {
    const tx = con.getRepository(UserTransaction).create({
      processor: UserTransactionProcessor.Paddle,
      receiverId: '1',
      status: UserTransactionStatus.Success,
      value: 100,
      valueIncFees: 100,
      fee: 0,
      request: {},
      flags: {},
      productId: null,
    });
    const transaction = await con.getRepository(UserTransaction).save(tx);

    await expectSuccessfulTypedBackground(worker, {
      transaction: transaction as unknown as ChangeObject<UserTransaction>,
    });

    const user = usersFixture[0];
    expect(sendEmail).toHaveBeenCalledWith({
      send_to_unsubscribed: true,
      transactional_message_id:
        CioTransactionalMessageTemplateId.UserBoughtCores,
      message_data: {
        core_amount: '+100',
      },
      identifiers: {
        id: user.id,
      },
      to: user.email,
    });
  });

  it('should do nothing if receiver is ghost user', async () => {
    const tx = con.getRepository(UserTransaction).create({
      processor: UserTransactionProcessor.Paddle,
      receiverId: ghostUser.id,
      status: UserTransactionStatus.Success,
      value: 100,
      valueIncFees: 100,
      fee: 0,
      request: {},
      flags: { emailSent: true },
      productId: null,
    });
    const transaction = await con.getRepository(UserTransaction).save(tx);

    await expectSuccessfulTypedBackground(worker, {
      transaction: transaction as unknown as ChangeObject<UserTransaction>,
    });

    expect(sendEmail).not.toHaveBeenCalled();
  });
});
