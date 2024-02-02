import { User, UserStreak, View } from '../entity';
import { messageToJson, Worker } from './worker';
import { DayOfWeek as Day } from '../types';
import { differenceInDays } from 'date-fns';
import { DataSource, DeepPartial, IsNull, Not } from 'typeorm';

interface Data {
  users: User[];
}

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

const worker: Worker = {
  subscription: 'api.v1.seed-user-streak',
  handler: async (message, con, logger) => {
    if (process.env.NODE_ENV === 'development') {
      return;
    }

    const { users } = messageToJson<Data>(message);

    const updates = await Promise.all(
      users.map((user) => computeReadingStreaksData(con, user)),
    );

    try {
      await con.getRepository(UserStreak).save(updates);
    } catch (err) {
      logger.error(
        { data: { users }, messageId: message.messageId, err },
        'Failed to seed user_streak data',
      );
      throw err;
    }
  },
};

export default worker;
