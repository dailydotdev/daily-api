import cron from '../../src/cron/seedUserStreaksScheduler';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { User } from '../../src/entity';

import { DataSource, DeepPartial } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { usersFixture120 } from '../fixture/user';
import { getRedisObject, ioRedisPool, setRedisObject } from '../../src/redis';
import { notifySeedUserStreak } from '../../src/common';

jest.mock('../../src/common/pubsub', () => ({
  ...jest.requireActual('../../src/common/pubsub'),
  notifySeedUserStreak: jest.fn(),
}));
const mockNotifySeedUserStreak = jest.mocked(notifySeedUserStreak);

let con: DataSource;
const redisKey = 'seed-user-streaks-last-user';
const PAGE_SIZE = 20;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await saveFixtures(con, User, usersFixture120);
  ioRedisPool.execute((client) => client.del(redisKey));
  process.env.USER_STREAKS_BATCH_SIZE = PAGE_SIZE.toString();

  jest.clearAllMocks();
});

afterAll(async () => {
  jest.restoreAllMocks();
});

const expectRedisUserPointer = async (
  user: DeepPartial<User>,
): Promise<void> => {
  const userPointerJSON = await getRedisObject(redisKey);
  expect(userPointerJSON).not.toBeNull();

  const userPointer = JSON.parse(userPointerJSON as string);
  expect(user.id).toEqual(userPointer.id);
  expect((user.createdAt as Date).toISOString()).toEqual(userPointer.createdAt);
};

it('should start scheduling users if redis is empty', async () => {
  await expectSuccessfulCron(cron);

  await expectRedisUserPointer(usersFixture120[PAGE_SIZE - 1]);

  expect(notifySeedUserStreak).toHaveBeenCalledTimes(1);
  const users = mockNotifySeedUserStreak.mock.calls[0][1];
  expect(users.length).toEqual(PAGE_SIZE);
  for (let i = 0; i < PAGE_SIZE; i++) {
    expect(users[i].id).toEqual(usersFixture120[i].id);
  }
});

it('paginates over users until end', async () => {
  const callCount = usersFixture120.length / PAGE_SIZE;

  for (let i = 0; i < callCount * 2; i++) {
    await expectSuccessfulCron(cron);
  }

  expect(notifySeedUserStreak).toHaveBeenCalledTimes(callCount);

  for (let call = 0; call < callCount; call++) {
    const users = mockNotifySeedUserStreak.mock.calls[call][1];
    expect(users.length).toEqual(PAGE_SIZE);
    for (let index = 0; index < PAGE_SIZE; index++) {
      expect(usersFixture120[call * PAGE_SIZE + index].id).toEqual(
        users[index].id,
      );
    }
  }

  await expectRedisUserPointer(usersFixture120[usersFixture120.length - 1]);
});

it('scheduling can be restarted from arbitrary point by modifying the redis pointer', async () => {
  const startFromIndex = 93;
  const userPointer = {
    id: usersFixture120[startFromIndex - 1].id,
    createdAt: usersFixture120[startFromIndex - 1].createdAt,
  };
  setRedisObject(redisKey, JSON.stringify(userPointer));

  for (let i = 0; i < 3; i++) {
    await expectSuccessfulCron(cron);
  }

  expect(notifySeedUserStreak).toHaveBeenCalledTimes(2);

  const users1 = mockNotifySeedUserStreak.mock.calls[0][1];
  expect(users1.length).toEqual(PAGE_SIZE);

  const users2 = mockNotifySeedUserStreak.mock.calls[1][1];
  expect(users2.length).toEqual(7);

  await expectRedisUserPointer(usersFixture120[usersFixture120.length - 1]);
});
