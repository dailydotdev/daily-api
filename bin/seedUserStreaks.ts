import fastq from 'fastq';
import { differenceInDays } from 'date-fns';

import '../src/config';
import createOrGetConnection from '../src/db';
import { User, UserStreak, View } from '../src/entity';
import { DataSource, DeepPartial, Equal, IsNull, MoreThan, Not } from 'typeorm';
import { DayOfWeek as Day } from '../src/types';

const QUEUE_CONCURRENCY = 1;
const BATCH_SIZE = 1000;

interface UserPointer {
  id?: string;
  createdAt?: string;
}

const addNextBatch = async (
  con: DataSource,
  insertQueue: fastq.queueAsPromised<Partial<User>[], void>,
  userPointer?: UserPointer,
  limit: number = BATCH_SIZE,
): Promise<UserPointer> => {
  const qb = con
    .getRepository(User)
    .createQueryBuilder('u')
    // fetching createdAt as a string, because Date object in node is milisecond precision, but postgres is microsecond
    .select(['id', 'timezone', '"createdAt"::text'])
    .where(
      userPointer?.createdAt
        ? {
            createdAt: MoreThan(userPointer?.createdAt),
          }
        : 'TRUE',
    )
    .orWhere(
      userPointer?.id
        ? {
            createdAt: Equal(userPointer.createdAt),
            id: MoreThan(userPointer.id),
          }
        : 'TRUE',
    )
    .orderBy('u."createdAt"', 'ASC')
    .addOrderBy('u."id"', 'ASC')
    .take(limit);

  const users = await qb.execute();

  // nothing to do anymore, all the users are processed
  if (users.length === 0) {
    console.log('no users to process');
    return null;
  }

  console.log(
    'Queuing batch of users to process',
    users.map((u) => u.id),
  );
  insertQueue.push(users);

  const lastUser = users[users.length - 1];
  return {
    id: lastUser.id,
    createdAt: lastUser.createdAt,
  };
};

interface ViewWithDateTz extends View {
  date: Date;
  maxTimestamp: Date;
}

const FREEZE_DAYS_IN_A_WEEK = 2;
const MISSED_LIMIT = 1;

const computeReadingStreaksData = async (
  con: DataSource,
  user: Partial<User>,
): Promise<DeepPartial<UserStreak>> => {
  const timeZone = user.timezone ?? 'UTC';

  const views: ViewWithDateTz[] = await con
    .getRepository(View)
    .createQueryBuilder()
    .select([])
    .addSelect('MAX(timestamp)', 'maxTimestamp')
    .addSelect('DATE(timestamp::timestamptz AT TIME ZONE :timezone)', 'date')
    .where({ userId: user.id, timestamp: Not(IsNull()) })
    .innerJoin(User, 'u', `"userId" = u.id`)
    .setParameter('timezone', timeZone)
    .addGroupBy('"date"')
    .orderBy('"maxTimestamp"', 'ASC')
    .getRawMany();

  if (!views || views.length === 0) {
    return {
      currentStreak: 0,
      totalStreak: 0,
      maxStreak: 0,
      lastViewAt: null,
      userId: user.id,
    };
  }

  const data = views.reduce(
    (acc: DeepPartial<UserStreak>, item: ViewWithDateTz, index: number) => {
      // prevent undefined results on first item
      const difference =
        index === 0 ? 1 : differenceInDays(item.date, acc.lastViewAt as Date);
      const day = item.date.getDay();

      // by default, increment streak
      let currentStreak = acc.currentStreak + 1;

      // restart streak if difference is greater than 1, taking freezes into account
      if (
        (day === Day.Sunday && difference > FREEZE_DAYS_IN_A_WEEK) ||
        (day === Day.Monday &&
          difference > FREEZE_DAYS_IN_A_WEEK + MISSED_LIMIT) ||
        (day > Day.Monday && difference > MISSED_LIMIT)
      ) {
        currentStreak = 1;
      }

      return {
        ...acc,
        currentStreak,
        totalStreak: acc.totalStreak + 1,
        maxStreak: Math.max(acc.maxStreak, currentStreak),
        lastViewAt: item.date,
      };
    },
    {
      currentStreak: 0,
      totalStreak: 0,
      maxStreak: 0,
      userId: user.id,
    },
  );

  // set lastViewAt to the timestamp of the last view
  data.lastViewAt = views[views.length - 1].maxTimestamp;
  return data;
};

(async () => {
  const con = await createOrGetConnection();

  let insertCount = 0;
  const insertQueue = fastq.promise(async (users: Partial<User>[]) => {
    const ids = users.map((u) => u.id);
    console.log('inserting user streaks for: ', ids);
    const updates = await Promise.all(
      users.map((user) => computeReadingStreaksData(con, user)),
    );

    try {
      await con.getRepository(UserStreak).save(updates);
    } catch (err) {
      console.error('Failed to insert user_streak data', users, err);
      throw err;
    }
    console.log('user streaks created for: ', ids);

    insertCount += ids.length;
  }, QUEUE_CONCURRENCY);

  let nextUser = undefined;
  let i = 0;
  while (nextUser !== null && i++ < 6) {
    nextUser = await addNextBatch(con, insertQueue, nextUser);
    console.log('nextUser', nextUser);
  }

  await insertQueue.drained();
  console.log('insertion finished with a total of: ', insertCount);
  process.exit();
})();
