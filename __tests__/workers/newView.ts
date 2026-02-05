import worker from '../../src/workers/newView';
import {
  expectSuccessfulBackground,
  expectSuccessfulCron,
  saveFixtures,
} from '../helpers';
import { postsFixture } from '../fixture/post';
import {
  Achievement,
  AchievementEventType,
  AchievementType,
  Alerts,
  ArticlePost,
  BRIEFING_SOURCE,
  PostType,
  Source,
  User,
  UserStreak,
  UserStreakAction,
  UserStreakActionType,
  View,
} from '../../src/entity';
import { BriefPost } from '../../src/entity/posts/BriefPost';
import { UserAchievement } from '../../src/entity/user/UserAchievement';
import { sourcesFixture } from '../fixture/source';
import { usersFixture } from '../fixture/user';
import { DataSource, IsNull, Not } from 'typeorm';
import createOrGetConnection from '../../src/db';
import cron from '../../src/cron/updateCurrentStreak';
import nock from 'nock';
import { ioRedisPool, setRedisObjectWithExpiry } from '../../src/redis';
import { generateStorageKey, StorageKey, StorageTopic } from '../../src/config';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await con.getRepository(UserStreak).clear();
  await con.getRepository(View).clear();
  await saveFixtures(
    con,
    User,
    usersFixture.map((u) => ({ ...u, id: `u${u.id}` })),
  );
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
  await ioRedisPool.execute((client) => client.flushall());
});

it('should save a new view without timestamp', async () => {
  await expectSuccessfulBackground(worker, {
    postId: 'p1',
    userId: 'u1',
    referer: 'referer',
    agent: 'agent',
    ip: '127.0.0.1',
  });
  const views = await con.getRepository(View).find();
  expect(views.length).toEqual(1);
  expect(views[0]).toMatchSnapshot({
    timestamp: expect.any(Date),
  });
});

it('should save a new view with the provided timestamp', async () => {
  const timestamp = new Date(2020, 5, 11, 1, 17);
  await expectSuccessfulBackground(worker, {
    postId: 'p1',
    userId: 'u1',
    referer: 'referer',
    agent: 'agent',
    ip: '127.0.0.1',
    timestamp: timestamp.toISOString(),
  });
  const views = await con.getRepository(View).find();
  expect(views.length).toEqual(1);
  expect(views[0]).toMatchSnapshot();

  const streak = await con
    .getRepository(UserStreak)
    .findOne({ where: { userId: 'u1', lastViewAt: timestamp } });
  expect(streak).toMatchSnapshot({
    updatedAt: expect.any(Date),
  });
});

it('should not save a new view within a week since the last view', async () => {
  const date1 = new Date(2020, 5, 11, 1, 17);
  const date2 = new Date(2020, 5, 13, 1, 17);
  const data = {
    postId: 'p1',
    userId: 'u1',
    referer: 'referer',
    agent: 'agent',
    ip: '127.0.0.1',
    timestamp: date1.toISOString(),
  };
  await expectSuccessfulBackground(worker, data);
  await expectSuccessfulBackground(worker, {
    ...data,
    timestamp: date2.toISOString(),
  });
  const views = await con.getRepository(View).find();
  expect(views.length).toEqual(1);
  expect(views[0]).toMatchSnapshot();
});

it('should save a new view after a week since the last view', async () => {
  const date1 = new Date(2020, 5, 11, 1, 17);
  const date2 = new Date(2020, 5, 19, 1, 17);
  const data = {
    postId: 'p1',
    userId: 'u1',
    referer: 'referer',
    agent: 'agent',
    ip: '127.0.0.1',
    timestamp: date1.toISOString(),
  };
  await expectSuccessfulBackground(worker, data);

  const streak1 = await con
    .getRepository(UserStreak)
    .findOne({ where: { userId: 'u1', lastViewAt: date1 } });
  expect(streak1).not.toBeNull();
  expect(streak1?.currentStreak).toEqual(1);

  await expectSuccessfulBackground(worker, {
    ...data,
    timestamp: date2.toISOString(),
  });

  const views = await con.getRepository(View).find();

  expect(views.length).toEqual(2);
  expect(views[1]).toMatchSnapshot();
});

describe('reading streaks', () => {
  const defaultStreak: Partial<UserStreak> = {
    currentStreak: 4,
    totalStreak: 42,
    maxStreak: 10,
  };

  const prepareTest = async (
    currentDate: Date | string | undefined,
    previousDate: Date | string | undefined,
    previousStreak: Partial<UserStreak> | null | undefined = defaultStreak,
  ) => {
    if (previousStreak) {
      await con.getRepository(UserStreak).save({
        ...previousStreak,
        userId: previousStreak.userId ?? 'u1',
        lastViewAt: previousDate ? new Date(previousDate) : undefined,
      });
    }

    const data = {
      postId: 'p1',
      userId: 'u1',
      referer: 'referer',
      agent: 'agent',
      ip: '127.0.0.1',
      timestamp: currentDate ? new Date(currentDate) : undefined,
    };
    await expectSuccessfulBackground(worker, data);
  };

  const runTest = async (
    currentDate: Date | string,
    previousDate: Date | string | undefined,
    previousStreak: Partial<UserStreak> | null | undefined = defaultStreak,
    expectedStreak?: Partial<UserStreak>,
  ) => {
    await prepareTest(currentDate, previousDate, previousStreak);

    const streak = await con.getRepository(UserStreak).findOne({
      where: {
        userId: 'u1',
      },
      order: { lastViewAt: 'DESC' },
    });
    for (const key in expectedStreak) {
      expect(streak?.[key]).toEqual(expectedStreak[key]);
    }
  };

  it('updates reading streak without a timestamp', async () => {
    await prepareTest(undefined, undefined);

    const streak = await con
      .getRepository(UserStreak)
      .findOne({ where: { userId: 'u1', lastViewAt: Not(IsNull()) } });
    expect(streak).toMatchSnapshot({
      updatedAt: expect.any(Date),
      lastViewAt: expect.any(Date),
    });
  });

  it('should set show recover to false if streak is greater than 1', async () => {
    await con
      .getRepository(Alerts)
      .update({ userId: 'u1' }, { showRecoverStreak: true });
    await prepareTest(undefined, undefined);

    const streak = await con
      .getRepository(UserStreak)
      .findOne({ where: { userId: 'u1', lastViewAt: Not(IsNull()) } });
    expect(streak.currentStreak).toBeGreaterThan(1);

    const alert = await con.getRepository(Alerts).findOneBy({ userId: 'u1' });
    expect(alert.showRecoverStreak).toBe(false);
  });

  it('should not change show recover if streak is 1', async () => {
    await con
      .getRepository(Alerts)
      .update({ userId: 'u1' }, { showRecoverStreak: true });
    await con
      .getRepository(UserStreak)
      .update({ userId: 'u1' }, { currentStreak: 0 });

    await runTest('2024-01-26T17:17Z', undefined, null, {
      currentStreak: 1,
      totalStreak: 1,
      maxStreak: 1,
      lastViewAt: new Date('2024-01-26T17:17Z'),
    });

    const streak = await con
      .getRepository(UserStreak)
      .findOne({ where: { userId: 'u1', lastViewAt: Not(IsNull()) } });
    expect(streak.currentStreak).toEqual(1);

    const alert = await con.getRepository(Alerts).findOneBy({ userId: 'u1' });
    expect(alert.showRecoverStreak).toBe(true);
  });

  it('should clear previous streak cache', async () => {
    const key = generateStorageKey(StorageTopic.Streak, StorageKey.Reset, 'u1');
    await setRedisObjectWithExpiry(key, 10, 3600);
    await prepareTest(undefined, undefined);

    const streak = await con
      .getRepository(UserStreak)
      .findOne({ where: { userId: 'u1', lastViewAt: Not(IsNull()) } });
    expect(streak.currentStreak).toBeGreaterThan(1);
    const value = await ioRedisPool.execute((client) => client.get(key));
    expect(value).toBeNull();
  });

  it('should not change previous streak cache', async () => {
    const key = generateStorageKey(StorageTopic.Streak, StorageKey.Reset, 'u1');
    await setRedisObjectWithExpiry(key, 10, 3600);
    await runTest('2024-01-26T17:17Z', undefined, null, {
      currentStreak: 1,
      totalStreak: 1,
      maxStreak: 1,
      lastViewAt: new Date('2024-01-26T17:17Z'),
    });

    const streak = await con
      .getRepository(UserStreak)
      .findOne({ where: { userId: 'u1', lastViewAt: Not(IsNull()) } });
    expect(streak.currentStreak).toEqual(1);
    const value = await ioRedisPool.execute((client) => client.get(key));
    expect(value).toEqual('10');
  });

  it('does not update reading streak if view was not written', async () => {
    await prepareTest('2024-01-25T17:17Z', '2024-01-24T14:17Z');

    const streak1 = await con
      .getRepository(UserStreak)
      .findOne({ where: { userId: 'u1', currentStreak: 5 } });
    expect(streak1).not.toBeNull();

    const data = {
      postId: 'p1',
      userId: 'u1',
      referer: 'referer',
      agent: 'agent',
      ip: '127.0.0.1',
      timestamp: new Date('2024-01-26T17:17Z'),
    };
    await expectSuccessfulBackground(worker, data);

    const streak2 = await con
      .getRepository(UserStreak)
      .findOne({ where: { userId: 'u1' } });
    expect(streak2?.updatedAt).toEqual(streak1?.updatedAt);
    expect(streak2?.currentStreak).toEqual(streak1?.currentStreak);
  });

  it('does not update reading streak if view does not have userId', async () => {
    const data = {
      postId: 'p1',
      referer: 'referer',
      agent: 'agent',
      ip: '127.0.0.1',
      timestamp: new Date('2024-01-26T17:17Z'),
    };
    await expectSuccessfulBackground(worker, data);

    const streak = await con.getRepository(UserStreak).findOne({
      where: { lastViewAt: new Date('2024-01-26T17:17Z') },
    });
    expect(streak).toBeNull();
  });

  it('does not update reading streak if userId does not match existing user', async () => {
    const data = {
      postId: 'p1',
      userId: '__this_userId_should_not_exist__',
      referer: 'referer',
      agent: 'agent',
      ip: '127.0.0.1',
      timestamp: new Date('2024-01-26T17:17Z'),
    };
    await expectSuccessfulBackground(worker, data);

    const streak = await con.getRepository(UserStreak).findOne({
      where: { lastViewAt: new Date('2024-01-26T17:17Z') },
    });
    expect(streak).toBeNull();
  });

  it('should start a reading streak if there was no row in user_streak table', async () => {
    await runTest('2024-01-26T17:17Z', undefined, null, {
      currentStreak: 1,
      totalStreak: 1,
      maxStreak: 1,
      lastViewAt: new Date('2024-01-26T17:17Z'),
    });
  });

  it('should start a reading streak if there was none before', async () => {
    await runTest(
      '2024-01-26T17:17Z',
      undefined,
      {
        currentStreak: 0,
        totalStreak: 0,
        maxStreak: 0,
      },
      {
        currentStreak: 1,
        totalStreak: 1,
        maxStreak: 1,
        lastViewAt: new Date('2024-01-26T17:17Z'),
      },
    );
  });

  it('should increment a reading streak if lastViewAt was yesterday', async () => {
    await runTest('2024-01-26T19:17Z', '2024-01-25T17:23Z', defaultStreak, {
      currentStreak: 5,
      totalStreak: 43,
      maxStreak: 10,
      lastViewAt: new Date('2024-01-26T19:17Z'),
    });
  });

  it('should increment maxStreak if lastViewAt was yesterday and current streak is bigger', async () => {
    await runTest(
      '2024-01-26T19:17Z',
      '2024-01-25T17:23Z',
      {
        currentStreak: 4,
        totalStreak: 98,
        maxStreak: 4,
      },
      {
        currentStreak: 5,
        totalStreak: 99,
        maxStreak: 5,
        lastViewAt: new Date('2024-01-26T19:17Z'),
      },
    );
  });

  it('should not increment maxStreak if lastViewAt was yesterday and current streak is smaller', async () => {
    await runTest(
      '2024-01-26T19:17Z',
      '2024-01-25T17:23Z',
      {
        currentStreak: 4,
        totalStreak: 98,
        maxStreak: 10,
      },
      {
        currentStreak: 5,
        totalStreak: 99,
        maxStreak: 10,
        lastViewAt: new Date('2024-01-26T19:17Z'),
      },
    );
  });

  it('should not increment a reading streak if lastViewAt is the same day', async () => {
    await runTest(
      '2024-01-26T17:23Z',
      '2024-01-26T15:23Z',
      defaultStreak,
      defaultStreak,
    );
  });

  describe('showMilestone is set correctly', () => {
    beforeEach(async () => {
      await con.getRepository(Alerts).clear();
    });

    it('should not set showStreakMilestone if current streak is same as max streak and not a fibonacci number', async () => {
      await runTest(
        '2024-01-26T19:17Z',
        '2024-01-25T17:23Z',
        { ...defaultStreak, currentStreak: 5, maxStreak: 5 },
        {
          currentStreak: 6,
          totalStreak: 43,
          maxStreak: 6,
          lastViewAt: new Date('2024-01-26T19:17Z'),
        },
      );

      const alerts = await con
        .getRepository(Alerts)
        .findOne({ where: { userId: 'u1' } });
      expect(alerts?.showStreakMilestone).toBe(false);
    });

    it('should not set showStreakMilestone if value is 1', async () => {
      await runTest(
        '2024-01-26T19:17Z',
        '2024-01-25T17:23Z',
        { ...defaultStreak, currentStreak: 0, maxStreak: 10 },
        {
          currentStreak: 1,
          totalStreak: 43,
          maxStreak: 10,
          lastViewAt: new Date('2024-01-26T19:17Z'),
        },
      );

      const alerts = await con
        .getRepository(Alerts)
        .findOne({ where: { userId: 'u1' } });
      expect(alerts?.showStreakMilestone).toBe(false);
    });

    it('should set showStreakMilestone to true if current streak is a fibonacci number', async () => {
      await runTest('2024-01-26T19:17Z', '2024-01-25T17:23Z', defaultStreak, {
        currentStreak: 5,
        totalStreak: 43,
        maxStreak: 10,
        lastViewAt: new Date('2024-01-26T19:17Z'),
      });

      const alerts = await con
        .getRepository(Alerts)
        .findOne({ where: { userId: 'u1' } });
      expect(alerts?.showStreakMilestone).toBe(true);
    });

    it('should set showStreakMilestone to false if current streak is NOT a fibonacci number and maxStreak is bigger', async () => {
      await runTest(
        '2024-01-26T19:17Z',
        '2024-01-25T17:23Z',
        {
          ...defaultStreak,
          currentStreak: 5,
        },
        {
          currentStreak: 6,
          totalStreak: 43,
          maxStreak: 10,
          lastViewAt: new Date('2024-01-26T19:17Z'),
        },
      );

      const alerts = await con
        .getRepository(Alerts)
        .findOne({ where: { userId: 'u1' } });
      expect(alerts?.showStreakMilestone).toBe(false);
    });

    it('should set showStreakMilestone to false even if previous value is true', async () => {
      await con.getRepository(Alerts).save({
        userId: 'u1',
        showStreakMilestone: true,
      });

      await runTest(
        '2024-01-26T19:17Z',
        '2024-01-25T17:23Z',
        {
          ...defaultStreak,
          currentStreak: 5,
        },
        {
          currentStreak: 6,
          totalStreak: 43,
          maxStreak: 10,
          lastViewAt: new Date('2024-01-26T19:17Z'),
        },
      );

      const alerts = await con
        .getRepository(Alerts)
        .findOne({ where: { userId: 'u1' } });
      expect(alerts?.showStreakMilestone).toBe(false);
    });

    it('should not set showStreakMilestone if lastViewAt is the same day', async () => {
      await runTest(
        '2024-01-26T17:23Z',
        '2024-01-26T17:23Z',
        {
          ...defaultStreak,
          currentStreak: 5,
        },
        {
          ...defaultStreak,
          currentStreak: 5,
        },
      );

      const alerts = await con
        .getRepository(Alerts)
        .findOne({ where: { userId: 'u1' } });
      expect(alerts).toBeNull();
    });

    it('should increment streak if user restored streak today', async () => {
      nock('http://localhost:5000').post('/e').reply(204);
      await runTest(
        '2024-01-08T17:23Z',
        '2024-01-05T17:23Z',
        {
          ...defaultStreak,
          currentStreak: 4,
        },
        {
          ...defaultStreak,
          totalStreak: 43,
          currentStreak: 5,
        },
      );

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
        .setSystemTime(new Date('2024-01-10')); // Thursday

      await expectSuccessfulCron(cron);

      const streak = await con
        .getRepository(UserStreak)
        .findOneBy({ userId: 'u1' });

      expect(streak.currentStreak).toBe(0);

      const today = new Date();

      await con.getRepository(UserStreakAction).save({
        userId: 'u1',
        type: UserStreakActionType.Recover,
        createdAt: today,
      });
      await con
        .getRepository(UserStreak)
        .update({ userId: 'u1' }, { currentStreak: 5 });

      const data = {
        postId: 'p2',
        userId: 'u1',
        referer: 'referer',
        agent: 'agent',
        ip: '127.0.0.1',
        timestamp: today,
      };
      await expectSuccessfulBackground(worker, data);

      const updated = await con
        .getRepository(UserStreak)
        .findOneBy({ userId: 'u1' });

      expect(updated?.currentStreak).toBe(6);
    });
  });
});

describe('brief read achievement', () => {
  const briefAchievementId = 'debriefed-achievement-id';

  beforeEach(async () => {
    // Seed the brief read achievement
    await con.getRepository(Achievement).save({
      id: briefAchievementId,
      name: 'Debriefed',
      description: 'Read 5 briefs',
      image: 'https://example.com/achievement.png',
      type: AchievementType.Milestone,
      eventType: AchievementEventType.BriefRead,
      criteria: { targetCount: 5 },
      points: 15,
    });

    // Create the briefing source if it doesn't exist
    await con.getRepository(Source).save({
      id: BRIEFING_SOURCE,
      name: 'Briefing',
      handle: 'briefing',
      private: true,
    });

    // Create a brief post
    await con.getRepository(BriefPost).save({
      id: 'brief-1',
      shortId: 'brief1',
      sourceId: BRIEFING_SOURCE,
      authorId: 'u1',
      title: 'Test Brief',
      type: PostType.Brief,
      private: true,
      visible: true,
    });
  });

  it('should increment BriefRead achievement progress when viewing a BriefPost', async () => {
    await expectSuccessfulBackground(worker, {
      postId: 'brief-1',
      userId: 'u2',
      referer: 'referer',
      timestamp: new Date().toISOString(),
    });

    const userAchievement = await con.getRepository(UserAchievement).findOne({
      where: { userId: 'u2', achievementId: briefAchievementId },
    });

    expect(userAchievement).not.toBeNull();
    expect(userAchievement?.progress).toBe(1);
    expect(userAchievement?.unlockedAt).toBeNull();
  });

  it('should unlock BriefRead achievement after reading 5 briefs', async () => {
    // Create 5 brief posts
    for (let i = 2; i <= 5; i++) {
      await con.getRepository(BriefPost).save({
        id: `brief-${i}`,
        shortId: `brief${i}`,
        sourceId: BRIEFING_SOURCE,
        authorId: 'u1',
        title: `Test Brief ${i}`,
        type: PostType.Brief,
        private: true,
        visible: true,
      });
    }

    // View all 5 briefs
    for (let i = 1; i <= 5; i++) {
      await expectSuccessfulBackground(worker, {
        postId: `brief-${i}`,
        userId: 'u2',
        referer: 'referer',
        timestamp: new Date().toISOString(),
      });
    }

    const userAchievement = await con.getRepository(UserAchievement).findOne({
      where: { userId: 'u2', achievementId: briefAchievementId },
    });

    expect(userAchievement).not.toBeNull();
    expect(userAchievement?.progress).toBe(5);
    expect(userAchievement?.unlockedAt).not.toBeNull();
  });

  it('should NOT trigger BriefRead achievement when viewing an article post', async () => {
    await expectSuccessfulBackground(worker, {
      postId: 'p1',
      userId: 'u1',
      referer: 'referer',
      timestamp: new Date().toISOString(),
    });

    const userAchievement = await con.getRepository(UserAchievement).findOne({
      where: { userId: 'u1', achievementId: briefAchievementId },
    });

    expect(userAchievement).toBeNull();
  });
});
