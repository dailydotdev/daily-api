import { expectSuccessfulBackground, saveFixtures } from '../helpers';
import worker from '../../src/workers/seedUserStreaks';
import { Post, Source, User, UserStreak, View } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
import { DataSource, DeepPartial, In } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { usersFixture } from '../fixture/user';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.resetAllMocks();

  await con.getRepository(View).clear();
  await con.getRepository(UserStreak).clear();

  await saveFixtures(
    con,
    User,
    (
      [
        { ...usersFixture[0], timezone: 'Asia/Jerusalem' },
      ] as DeepPartial<User>[]
    )
      .concat(usersFixture.slice(1, 3))
      .concat([{ ...usersFixture[3], timezone: 'America/Los_Angeles' }]),
  );
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
});

it('should write user_streaks for all users in the message', async () => {
  const views: DeepPartial<View>[] = [
    {
      userId: '1',
      postId: 'p1',
      timestamp: new Date('2024-01-01T14:00:00Z'), // Monday
    },
    {
      userId: '1',
      postId: 'p2',
      timestamp: new Date('2024-01-02T14:00:00Z'), // Tuesday
    },
    {
      userId: '3',
      postId: 'p2',
      timestamp: new Date('2024-01-02T14:10:00Z'), // Tuesday
    },
    {
      userId: '1',
      postId: 'p3',
      timestamp: new Date('2024-01-03T14:00:00Z'), // Wednesday
    },
    {
      userId: '3',
      postId: 'p3',
      timestamp: new Date('2024-01-03T14:10:00Z'), // Wednesday
    },
    {
      userId: '1',
      postId: 'p4',
      timestamp: new Date('2024-01-04T14:00:00Z'), // Thursday
    },
  ];

  await saveFixtures(con, View, views);

  const users = await con.getRepository(User).findBy({ id: In(['3', '1']) });

  await expectSuccessfulBackground(worker, { users });

  const userStreaks = await con
    .getRepository(UserStreak)
    .findBy({ userId: In(['1', '3']) });
  expect(userStreaks).toEqual([
    expect.objectContaining({
      userId: '1',
      currentStreak: 4,
      totalStreak: 4,
      maxStreak: 4,
    }),
    expect.objectContaining({
      userId: '3',
      currentStreak: 2,
      totalStreak: 2,
      maxStreak: 2,
    }),
  ]);
});

describe('streak calculations', () => {
  const prepareData = async (...dates: Date[]) => {
    const views: DeepPartial<View>[] = dates.map((date) => ({
      userId: '1',
      postId: 'p4',
      timestamp: date,
    }));
    await saveFixtures(con, View, views);

    const users = usersFixture.slice(0, 1);
    await expectSuccessfulBackground(worker, { users });
  };

  const expectStreak = async (streak: DeepPartial<UserStreak>) => {
    const userStreaks = await con
      .getRepository(UserStreak)
      .findBy({ userId: '1' });
    expect(userStreaks).toEqual([expect.objectContaining(streak)]);
  };

  it(`should increment streak on consecutive days`, async () => {
    await prepareData(
      new Date('2024-01-01T14:00:00Z'), // Monday
      new Date('2024-01-02T14:00:00Z'), // Tuesday
      new Date('2024-01-03T14:00:00Z'), // Wednesday
    );

    await expectStreak({
      currentStreak: 3,
      totalStreak: 3,
      maxStreak: 3,
    });
  });

  it(`should increment streak if it's Monday and last view was Friday`, async () => {
    await prepareData(
      new Date('2024-01-05T14:00:00Z'), // Friday
      new Date('2024-01-08T14:00:00Z'), // Monday
    );

    await expectStreak({
      currentStreak: 2,
      totalStreak: 2,
      maxStreak: 2,
    });
  });

  it(`should increment streak if it's Monday and last view was Saturday`, async () => {
    await prepareData(
      new Date('2024-01-06T14:00:00Z'), // Saturday
      new Date('2024-01-08T14:00:00Z'), // Monday
    );

    await expectStreak({
      currentStreak: 2,
      totalStreak: 2,
      maxStreak: 2,
    });
  });

  it(`should restart streak if it's Monday and last view was Thursday`, async () => {
    await prepareData(
      new Date('2024-01-04T14:00:00Z'), // Thursday
      new Date('2024-01-08T14:00:00Z'), // Monday
    );

    await expectStreak({
      currentStreak: 1,
      totalStreak: 2,
      maxStreak: 1,
    });
  });

  it(`should restart streak if it's Tuesday and last view was Friday`, async () => {
    await prepareData(
      new Date('2024-01-05T14:00:00Z'), // Friday
      new Date('2024-01-09T14:00:00Z'), // Tuesday
    );

    await expectStreak({
      currentStreak: 1,
      totalStreak: 2,
      maxStreak: 1,
    });
  });

  it(`should increment maxStreak and totalStreak properly`, async () => {
    await prepareData(
      new Date('2024-01-01T14:00:00Z'), // Monday
      new Date('2024-01-03T14:00:00Z'), // Wednesday
      new Date('2024-01-04T14:00:00Z'), // Thursday
      new Date('2024-01-05T14:00:00Z'), // Friday
      new Date('2024-01-09T14:00:00Z'), // Tuesday
      new Date('2024-01-10T14:00:00Z'), // Wednesday
      new Date('2024-01-11T14:00:00Z'), // Thursday
      new Date('2024-01-12T14:00:00Z'), // Friday
      new Date('2024-01-23T14:00:00Z'), // Tuesday
      new Date('2024-01-24T14:00:00Z'), // Wednesday
    );

    await expectStreak({
      currentStreak: 2,
      totalStreak: 10,
      maxStreak: 4,
    });
  });
});

it('handles timezones correctly', async () => {
  const views: DeepPartial<View>[] = [
    {
      userId: '1',
      postId: 'p1',
      timestamp: new Date('2024-01-01T14:00:00Z'), // 2024-01-01T16:00:00+02:00 in Asia/Jerusalem
    },
    {
      userId: '1',
      postId: 'p2',
      timestamp: new Date('2024-01-01T22:20:00Z'), // 2024-01-02T00:20:00+02:00 in Asia/Jerusalem -> next day, streak should increment
    },
    {
      userId: '4',
      postId: 'p2',
      timestamp: new Date('2024-01-02T14:10:00Z'), // 2024-01-02T06:10:00-08:00 in America/Los_Angeles
    },
    {
      userId: '4',
      postId: 'p3',
      timestamp: new Date('2024-01-03T07:00:00Z'), // 2024-01-02T23:00:00-08:00 in America/Los_Angeles -> same as previous date, so no streak increment
    },
  ];

  await saveFixtures(con, View, views);

  const users = await con.getRepository(User).findBy({ id: In(['1', '4']) });

  await expectSuccessfulBackground(worker, { users });

  const userStreaks = await con
    .getRepository(UserStreak)
    .findBy({ userId: In(['1', '4']) });
  expect(userStreaks).toEqual([
    expect.objectContaining({
      userId: '1',
      currentStreak: 2,
      totalStreak: 2,
      maxStreak: 2,
    }),
    expect.objectContaining({
      userId: '4',
      currentStreak: 1,
      totalStreak: 1,
      maxStreak: 1,
    }),
  ]);
});

// it('should create a reputation event that increases reputation', async () => {
//   await expectSuccessfulBackground(worker, {
//     userId: '2',
//     postId: 'p1',
//   });
//   const event = await con
//     .getRepository(ReputationEvent)
//     .findOne({ where: { targetId: 'p1', grantById: '2', grantToId: '1' } });
//   expect(event.amount).toEqual(10);
// });

// it('should not create a reputation event when the upvoting user is ineligible', async () => {
//   await con.getRepository(User).update({ id: '2' }, { reputation: 249 });
//   await expectSuccessfulBackground(worker, {
//     userId: '2',
//     postId: 'p1',
//   });
//   const event = await con
//     .getRepository(ReputationEvent)
//     .findOneBy({ targetId: 'p1', grantById: '2', grantToId: '1' });
//   expect(event).toEqual(null);
// });

// it('should not create a reputation event when the author is the upvote user', async () => {
//   await expectSuccessfulBackground(worker, {
//     userId: '1',
//     postId: 'p1',
//   });

//   const event = await con
//     .getRepository(ReputationEvent)
//     .findOneBy({ targetId: 'p1', grantById: '2', grantToId: '1' });
//   expect(event).toEqual(null);
// });
