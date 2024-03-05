import worker from '../../src/workers/newView';
import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import { postsFixture } from '../fixture/post';
import {
  Alerts,
  ArticlePost,
  Source,
  User,
  UserStreak,
  View,
} from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { usersFixture } from '../fixture/user';
import { DataSource, IsNull, Not } from 'typeorm';
import createOrGetConnection from '../../src/db';

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
        lastViewAt: new Date(currentDate),
      },
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
    await runTest('2024-01-26T19:17Z', '2024-01-26T17:23Z', defaultStreak, {
      ...defaultStreak,
      lastViewAt: new Date('2024-01-26T19:17Z'),
    });
  });

  describe('showMilestone is set correctly', () => {
    beforeEach(async () => {
      await con.getRepository(Alerts).clear();
    });

    it('should set showStreakMilestone to true if current streak is same as max streak and not a fibonacci number', async () => {
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
      expect(alerts?.showStreakMilestone).toBe(true);
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
        '2024-01-26T19:17Z',
        '2024-01-26T17:23Z',
        {
          ...defaultStreak,
          currentStreak: 5,
        },
        {
          ...defaultStreak,
          currentStreak: 5,
          lastViewAt: new Date('2024-01-26T19:17Z'),
        },
      );

      const alerts = await con
        .getRepository(Alerts)
        .findOne({ where: { userId: 'u1' } });
      expect(alerts).toBeNull();
    });
  });
});
