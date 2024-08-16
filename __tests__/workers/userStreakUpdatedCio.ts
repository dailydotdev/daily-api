import { expectSuccessfulTypedBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/userStreakUpdatedCio';
import { Post, Source, User, UserStreak, View } from '../../src/entity';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { typedWorkers } from '../../src/workers';
import { sourcesFixture, usersFixture } from '../fixture';
import nock from 'nock';
import { ChangeObject } from '../../src/types';
import { PubSubSchema } from '../../src/common';
import { cio } from '../../src/cio';
import { postsFixture } from '../fixture/post';

jest.mock('../../src/cio', () => ({
  ...(jest.requireActual('../../src/cio') as Record<string, unknown>),
  cio: { identify: jest.fn() },
}));

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.clearAllMocks();
  nock.cleanAll();
  process.env.CIO_SITE_ID = 'wolololo';
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
});

afterEach(() => {
  jest.useRealTimers();
});

describe('userStreakUpdatedCio worker', () => {
  type ObjectType = Partial<UserStreak>;
  const base: ChangeObject<ObjectType> = {
    userId: '1',
    currentStreak: 2,
    totalStreak: 3,
    maxStreak: 4,
    lastViewAt: 1714577744717000,
    updatedAt: 1714577744717000,
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    await saveFixtures(con, User, [usersFixture[0]]);
  });

  it('should be registered', () => {
    const registeredWorker = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );

    expect(registeredWorker).toBeDefined();
  });

  it('should update customer.io', async () => {
    await expectSuccessfulTypedBackground(worker, {
      streak: base,
    } as unknown as PubSubSchema['api.v1.user-streak-updated']);
    expect(cio.identify).toHaveBeenCalledWith('1', {
      current_streak: 2,
      total_streak: 3,
      max_streak: 4,
      last_seven_days_streak: [
        { day: 'Th', read: false },
        { day: 'Fr', read: false },
        { day: 'Sa', read: false },
        { day: 'Su', read: false },
        { day: 'Mo', read: false },
        { day: 'Tu', read: false },
        { day: 'We', read: false },
      ],
      last_view_at: 1714577744,
    });
  });

  it('should update customer.io with custom last seven days data', async () => {
    await saveFixtures(con, Source, sourcesFixture);
    await saveFixtures(con, Post, postsFixture);
    await con.getRepository(View).save([
      {
        postId: postsFixture[0].id,
        userId: '1',
        timestamp: new Date('2024-06-25'),
      },
      {
        postId: postsFixture[1].id,
        userId: '1',
        timestamp: new Date('2024-06-23'),
      },
      {
        postId: postsFixture[2].id,
        userId: '1',
        timestamp: new Date('2024-06-20'),
      },
    ]);

    await expectSuccessfulTypedBackground(worker, {
      streak: base,
    } as unknown as PubSubSchema['api.v1.user-streak-updated']);
    expect(cio.identify).toHaveBeenCalledWith('1', {
      current_streak: 2,
      total_streak: 3,
      max_streak: 4,
      last_seven_days_streak: [
        { day: 'Th', read: true },
        { day: 'Fr', read: false },
        { day: 'Sa', read: false },
        { day: 'Su', read: true },
        { day: 'Mo', read: false },
        { day: 'Tu', read: true },
        { day: 'We', read: false },
      ],
      last_view_at: 1714577744,
    });
  });
});
