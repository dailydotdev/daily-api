import cron from '../../src/cron/syncSubscriptionWithCIO';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { usersFixture } from '../fixture/user';
import { crons } from '../../src/cron/index';
import { StorageKey, StorageTopic, generateStorageKey } from '../../src/config';
import {
  deleteKeysByPattern,
  getRedisListLength,
  pushToRedisList,
} from '../../src/redis';
import { syncSubscription } from '../../src/common';
import { User } from '../../src/entity/user/User';
import createOrGetConnection from '../../src/db';
import type { DataSource } from 'typeorm';

jest.mock('../../src/common/mailing', () => ({
  ...(jest.requireActual('../../src/common/mailing') as Record<
    string,
    unknown
  >),
  syncSubscription: jest.fn(),
}));

let con: DataSource;

const redisKey = generateStorageKey(
  StorageTopic.CIO,
  StorageKey.Reporting,
  'global',
);

beforeEach(async () => {
  con = await createOrGetConnection();

  jest.resetAllMocks();
  await deleteKeysByPattern(redisKey);

  await saveFixtures(con, User, usersFixture);
});

describe('syncSubscriptionWithCIO cron', () => {
  it('should be registered', () => {
    const registeredWorker = crons.find((item) => item.name === cron.name);

    expect(registeredWorker).toBeDefined();
  });

  it('should sync subscriptions with customer.io', async () => {
    for (const user of usersFixture) {
      await pushToRedisList(redisKey, user.id as string);
    }
    expect(await getRedisListLength(redisKey)).not.toEqual(0);

    await expectSuccessfulCron(cron);
    expect(await getRedisListLength(redisKey)).toEqual(0);
    expect(syncSubscription).toHaveBeenCalledTimes(1);

    expect((syncSubscription as jest.Mock).mock.calls[0][0].length).toEqual(4);
    usersFixture.forEach((user) => {
      expect((syncSubscription as jest.Mock).mock.calls[0][0]).toContain(
        user.id,
      );
    });
  });

  it('should remove duplicates before calling syncSubscription', async () => {
    for (const user of usersFixture) {
      await pushToRedisList(redisKey, user.id as string);
      await pushToRedisList(redisKey, user.id as string);
    }
    expect(await getRedisListLength(redisKey)).not.toEqual(0);

    await expectSuccessfulCron(cron);
    expect(await getRedisListLength(redisKey)).toEqual(0);
    expect(syncSubscription).toHaveBeenCalledTimes(1);

    expect((syncSubscription as jest.Mock).mock.calls[0][0].length).toEqual(4);
    usersFixture.forEach((user) => {
      expect((syncSubscription as jest.Mock).mock.calls[0][0]).toContain(
        user.id,
      );
    });
  });

  it('should not call syncSubscription if there are no users in the queue', async () => {
    expect(await getRedisListLength(redisKey)).toEqual(0);
    await expectSuccessfulCron(cron);
    expect(syncSubscription).toHaveBeenCalledTimes(0);
  });
});
