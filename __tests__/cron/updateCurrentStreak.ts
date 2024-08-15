import { crons } from '../../src/cron/index';
import cron from '../../src/cron/updateCurrentStreak';
import { usersFixture } from '../fixture';
import { User, UserStreak } from '../../src/entity';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import nock from 'nock';
import { UserStreakAction, UserStreakActionType } from '../../src/entity';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

const doNotFake: FakeableAPI[] = [
  'hrtime',
  'nextTick',
  'performance',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
];

beforeEach(async () => {
  jest.useFakeTimers({ doNotFake }).setSystemTime(new Date('2024-06-26')); // Wednesday
  await saveFixtures(con, User, [usersFixture[0]]);
  await con.getRepository(UserStreak).save([
    {
      userId: '1',
      currentStreak: 1,
      lastViewAt: new Date('2024-06-24'), // Monday
    },
  ]);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('updateCurrentStreak cron', () => {
  it('should be registered', () => {
    const registeredWorker = crons.find((item) => item.name === cron.name);

    expect(registeredWorker).toBeDefined();
  });

  it('should reset a past streak if 2 days old', async () => {
    nock('http://localhost:5000').post('/e').reply(204);
    await expectSuccessfulCron(cron);
    const streak = await con
      .getRepository(UserStreak)
      .findOneBy({ userId: '1' });
    expect(streak.currentStreak).toBe(0);
  });

  it('should not reset a past streak if 1 days old', async () => {
    await con
      .getRepository(UserStreak)
      .update({ userId: '1' }, { lastViewAt: new Date('2024-06-25') });
    await expectSuccessfulCron(cron);
    const streak = await con
      .getRepository(UserStreak)
      .findOneBy({ userId: '1' });
    expect(streak.currentStreak).toBe(1);
  });

  it('should not reset a past streak if weekend', async () => {
    // This is a friday
    await con
      .getRepository(UserStreak)
      .update({ userId: '1' }, { lastViewAt: new Date('2024-06-21') });
    // This is a Monday
    jest.useFakeTimers({ doNotFake }).setSystemTime(new Date('2024-06-24'));
    await expectSuccessfulCron(cron);
    const streak = await con
      .getRepository(UserStreak)
      .findOneBy({ userId: '1' });
    expect(streak.currentStreak).toBe(1);
  });

  describe('incorporating streaks recovery', () => {
    beforeEach(() => {
      nock('http://localhost:5000').post('/e').reply(204);
    });

    it('should not reset streak if user has recovered date of today', async () => {
      /*
      Day today is Wednesday
      1. Last read was Monday
      2. User did not read anything on Tuesday
      3. Wednesday arrived and resets the streak to 0
      4. User recovers the streak on Wednesday
      5. When the cron job runs, streak should stay at 1
    */
      await con.getRepository(UserStreakAction).save([
        {
          userId: '1',
          createdAt: new Date('2024-06-26'),
          type: UserStreakActionType.Recover,
        },
      ]);
      await expectSuccessfulCron(cron);
      const streak = await con
        .getRepository(UserStreak)
        .findOneBy({ userId: '1' });
      expect(streak.currentStreak).toBe(1);
    });

    it('should reset streak if a day had passed after restoring the streak', async () => {
      jest.useFakeTimers({ doNotFake }).setSystemTime(new Date('2024-06-27')); // Thursday
      /*
      1. Last read was Monday
      2. User did not read anything on Tuesday
      3. Wednesday arrived and resets the streak to 0
      4. User recovers the streak on Wednesday but did not read again
      5. Thursday should reset the streak to 0
    */
      await con.getRepository(UserStreakAction).save([
        {
          userId: '1',
          createdAt: new Date('2024-06-26'),
          type: UserStreakActionType.Recover,
        },
      ]);
      await expectSuccessfulCron(cron);
      const streak = await con
        .getRepository(UserStreak)
        .findOneBy({ userId: '1' });
      expect(streak.currentStreak).toBe(0);
    });

    it('should reset streak if two days had passed after restoring the streak', async () => {
      jest.useFakeTimers({ doNotFake }).setSystemTime(new Date('2024-06-28')); // Friday
      /*
      1. Last read was Monday
      2. User did not read anything on Tuesday
      3. Wednesday arrived and resets the streak to 0
      4. User recovers the streak on Wednesday but did not read again
      5. Friday should reset the streak to 0
    */
      await saveFixtures(con, User, [usersFixture[1]]);
      await con.getRepository(UserStreak).save([
        {
          userId: '2',
          currentStreak: 10,
          lastViewAt: new Date('2024-06-21'),
        },
      ]);
      await con.getRepository(UserStreakAction).save([
        {
          userId: '2',
          createdAt: new Date('2024-06-25'),
          type: UserStreakActionType.Recover,
        },
      ]);
      await expectSuccessfulCron(cron);
      const streak = await con
        .getRepository(UserStreak)
        .findOneBy({ userId: '2' });
      expect(streak.currentStreak).toBe(0);
    });

    it('should reset on Monday if user recovered on Friday but still did not read', async () => {
      jest.useFakeTimers({ doNotFake }).setSystemTime(new Date('2024-06-24')); // Monday
      /*
      1. Last read was Wednesday
      2. User did not read anything on Thursday
      3. Friday arrived and resets the streak to 0
      4. User recovers the streak on Friday but did not read again
      5. Monday should reset the streak to 0
    */
      await saveFixtures(con, User, [usersFixture[1]]);
      await con.getRepository(UserStreak).save([
        {
          userId: '2',
          currentStreak: 10,
          lastViewAt: new Date('2024-06-19'),
        },
      ]);
      await con.getRepository(UserStreakAction).save([
        {
          userId: '2',
          createdAt: new Date('2024-06-21'),
          type: UserStreakActionType.Recover,
        },
      ]);
      await expectSuccessfulCron(cron);
      const streak = await con
        .getRepository(UserStreak)
        .findOneBy({ userId: '2' });
      expect(streak.currentStreak).toBe(0);
    });

    it('should reset on weekend if user recovered on Friday but still did not read', async () => {
      jest.useFakeTimers({ doNotFake }).setSystemTime(new Date('2024-06-22')); // Monday
      /*
      1. Last read was Wednesday
      2. User did not read anything on Thursday
      3. Friday arrived and resets the streak to 0
      4. User recovers the streak on Friday but did not read again
      5. Saturday arrived should reset streak as it is the same thing as being on Monday
    */
      await saveFixtures(con, User, [usersFixture[1]]);
      await con.getRepository(UserStreak).save([
        {
          userId: '2',
          currentStreak: 10,
          lastViewAt: new Date('2024-06-19'),
        },
      ]);
      await con.getRepository(UserStreakAction).save([
        {
          userId: '2',
          createdAt: new Date('2024-06-21'),
          type: UserStreakActionType.Recover,
        },
      ]);
      await expectSuccessfulCron(cron);
      const streak = await con
        .getRepository(UserStreak)
        .findOneBy({ userId: '2' });
      expect(streak.currentStreak).toBe(0);
    });
  });
});
