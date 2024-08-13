import { crons } from '../../src/cron/index';
import cron from '../../src/cron/updateCurrentStreak';
import { usersFixture } from '../fixture';
import { User, UserStreak } from '../../src/entity';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import nock from 'nock';
import {
  ReadingStreakActions,
  ReadingStreakActionType,
} from '../../src/entity/ReadingStreakActions';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest
    .useFakeTimers({
      doNotFake: [
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
      ],
    })
    .setSystemTime(new Date('2024-06-26'));
  await saveFixtures(con, User, [usersFixture[0]]);
  await con.getRepository(UserStreak).save([
    {
      userId: '1',
      currentStreak: 1,
      lastViewAt: new Date('2024-06-24'),
    },
    {
      userId: '2',
      currentStreak: 0,
      lastViewAt: new Date('2024-06-24'),
    },
  ]);
  await con.getRepository(ReadingStreakActions).save([
    {
      id: '1',
      userStreak: Promise.resolve({
        userId: '2',
        currentStreak: 0,
        lastViewAt: new Date('2024-06-24'),
      }),
      timestamp: new Date('2024-06-25'),
      type: ReadingStreakActionType.Recover,
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
    jest
      .useFakeTimers({
        doNotFake: [
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
        ],
      })
      .setSystemTime(new Date('2024-06-24'));
    await expectSuccessfulCron(cron);
    const streak = await con
      .getRepository(UserStreak)
      .findOneBy({ userId: '1' });
    expect(streak.currentStreak).toBe(1);
  });

  it('should not reset a past streak if user has recovered', async () => {
    await expectSuccessfulCron(cron);
    const streak = await con
      .getRepository(UserStreak)
      .findOneBy({ userId: '2' });
    expect(streak.currentStreak).toBe(10);
  });
});
