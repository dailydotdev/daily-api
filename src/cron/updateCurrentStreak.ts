import { Cron } from './cron';
import {
  User,
  UserStreak,
  UserStreakAction,
  UserStreakActionType,
} from '../entity';
import { checkUserStreak, clearUserStreak } from '../common';
import { counters } from '../telemetry';

const cron: Cron = {
  name: 'update-current-streak',
  handler: async (con, logger) => {
    try {
      const streakCounter = counters?.cron?.streakUpdate;
      await con.transaction(async (entityManager): Promise<void> => {
        const usersPastStreakTime = await entityManager
          .createQueryBuilder()
          .select(
            `us.*, (date_trunc('day', us."lastViewAt" at time zone COALESCE(u.timezone, 'utc'))::date) AS "lastViewAtTz", u.timezone`,
          )
          .addSelect('us.currentStreak', 'current')
          .addSelect('u."weekStart"', 'weekStart')
          .addSelect(
            `(date_trunc('day', usa."lastRecoverAt" at time zone COALESCE(u.timezone, 'utc'))::date) - interval '1 day'`,
            'lastRecoverAt',
          )
          .from(UserStreak, 'us')
          .innerJoin(User, 'u', 'u.id = us."userId"')
          .leftJoin(
            (qb) =>
              qb
                .select('MAX(a."createdAt")', 'lastRecoverAt')
                .addSelect('a."userId"', 'userId')
                .from(UserStreakAction, 'a')
                .where(`a.type = :type`, { type: UserStreakActionType.Recover })
                .groupBy('a."userId"'),
            'usa',
            'usa."userId" = us."userId"',
          )
          .where(`us."currentStreak" != 0`)
          .andWhere(
            `(date_trunc('day', us."lastViewAt" at time zone COALESCE(u.timezone, 'utc'))::date) < (date_trunc('day', now() at time zone COALESCE(u.timezone, 'utc'))::date) - interval '1 day'`,
          )
          .andWhere(
            `
            (
              usa."lastRecoverAt" IS NULL OR
              (
                (date_trunc('day', usa."lastRecoverAt" at time zone COALESCE(u.timezone, 'utc'))::date)
                  <
                (date_trunc('day', now() at time zone COALESCE(u.timezone, 'utc'))::date)
              )
            )`,
          )
          .getRawMany();

        const userIdsToReset: string[] = [];
        usersPastStreakTime.forEach(({ lastRecoverAt, ...userStreak }) => {
          if (checkUserStreak(userStreak, lastRecoverAt)) {
            userIdsToReset.push(userStreak.userId);
          }
        });

        if (!userIdsToReset.length) {
          logger.info('no user streaks to reset');
          return;
        }

        const clearedStreaks = await clearUserStreak(
          entityManager,
          userIdsToReset,
        );
        streakCounter?.add(usersPastStreakTime.length, {
          type: 'users_in_cron',
        });
        streakCounter?.add(clearedStreaks, { type: 'users_updated' });
      });
      logger.info('updated current streak cron');
    } catch (err) {
      logger.error({ err }, 'failed to update current streak cron');
    }
  },
};

export default cron;
