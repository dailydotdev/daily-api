import { cleanStaleUserTransactions as cron } from '../../src/cron/cleanStaleUserTransactions';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
} from '../../src/entity/user/UserTransaction';
import { sub } from 'date-fns';
import { crons } from '../../src/cron/index';
import { User } from '../../src/entity/user/User';
import { usersFixture } from '../fixture';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await saveFixtures(
    con,
    User,
    usersFixture.map((user) => {
      return {
        ...user,
        id: `${user.id}-clstc`,
        username: `${user.username}-clstc`,
      };
    }),
  );

  await saveFixtures(con, UserTransaction, [
    {
      processor: UserTransactionProcessor.Paddle,
      receiverId: '1-clstc',
      status: UserTransactionStatus.Success,
      productId: null,
      senderId: null,
      fee: 0,
      value: 42,
      valueIncFees: 42,
      createdAt: sub(new Date(), { days: 100 }),
      updatedAt: sub(new Date(), { days: 100 }),
      flags: {
        providerId: '1',
      },
    },
    {
      processor: UserTransactionProcessor.Paddle,
      receiverId: '3-clstc',
      status: UserTransactionStatus.ErrorRecoverable,
      productId: null,
      senderId: null,
      fee: 0,
      value: 42,
      valueIncFees: 42,
      flags: {
        providerId: '2',
      },
    },
    {
      processor: UserTransactionProcessor.Paddle,
      receiverId: '2-clstc',
      status: UserTransactionStatus.Processing,
      productId: null,
      senderId: null,
      fee: 0,
      value: 42,
      valueIncFees: 42,
      createdAt: sub(new Date(), { days: 100 }),
      updatedAt: sub(new Date(), { days: 100 }),
      flags: {
        providerId: '3',
      },
    },
    {
      processor: UserTransactionProcessor.Paddle,
      receiverId: '1-clstc',
      status: UserTransactionStatus.Created,
      productId: null,
      senderId: null,
      fee: 0,
      value: 42,
      valueIncFees: 42,
      createdAt: sub(new Date(), { days: 22 }),
      updatedAt: sub(new Date(), { days: 22 }),
      flags: {
        providerId: '4',
      },
    },
    {
      processor: UserTransactionProcessor.Paddle,
      receiverId: '1-clstc',
      status: UserTransactionStatus.Created,
      productId: null,
      senderId: null,
      fee: 0,
      value: 42,
      valueIncFees: 42,
      createdAt: sub(new Date(), { days: 24 }),
      updatedAt: sub(new Date(), { days: 27 }),
      flags: {
        providerId: '5',
      },
    },
    {
      processor: UserTransactionProcessor.Paddle,
      receiverId: '2-clstc',
      status: UserTransactionStatus.Created,
      productId: null,
      senderId: null,
      fee: 0,
      value: 42,
      valueIncFees: 42,
      createdAt: sub(new Date(), { days: 5 }),
      updatedAt: sub(new Date(), { days: 10 }),
      flags: {
        providerId: '6',
      },
    },
    {
      processor: UserTransactionProcessor.Paddle,
      receiverId: '2-clstc',
      status: UserTransactionStatus.Created,
      productId: null,
      senderId: null,
      fee: 0,
      value: 42,
      valueIncFees: 42,
      flags: {
        providerId: '7',
      },
    },
  ]);
});

describe('cleanStaleUserTransactions cron', () => {
  it('should be registered', () => {
    const registeredWorker = crons.find((item) => item.name === cron.name);

    expect(registeredWorker).toBeDefined();
  });

  it('should clean created transactions not updated for more then 21 days', async () => {
    await expectSuccessfulCron(cron);

    const userTransactions = await con
      .getRepository(UserTransaction)
      .find({ order: { updatedAt: 'ASC' } });

    expect(userTransactions.length).toEqual(5);

    expect(
      userTransactions
        .filter((item) => item.status === UserTransactionStatus.Created)
        .map((item) => item.flags.providerId),
    ).toEqual(['6', '7']);

    expect(userTransactions.map((item) => item.flags.providerId)).toEqual([
      '1',
      '3',
      '6',
      '2',
      '7',
    ]);
  });
});
