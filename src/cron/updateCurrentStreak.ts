import { Cron } from './cron';
import {
  User,
  UserStreak,
  UserStreakAction,
  UserStreakActionType,
} from '../entity';
import { Settings } from '../entity/Settings';
import {
  checkUserStreak,
  clearUserStreak,
  combineLastActionDates,
  getMissedStreakDays,
  publishStreakFreezeEvents,
  tryConsumeStreakFreeze,
} from '../common/users';
import type { StreakFreezeEvent } from '../common/users';
import { counters } from '../telemetry';

const cron: Cron = {
  name: 'update-current-streak',
  handler: async (con, logger) => {
    try {
      const streakCounter = counters?.cron?.streakUpdate;
      // Freeze events are published after the transaction commits, so a
      // rollback cannot leave users with notifications for freezes that
      // were never consumed.
      const freezeEvents: StreakFreezeEvent[] = [];
      await con.transaction(async (entityManager): Promise<void> => {
        const usersPastStreakTime = await entityManager
          .createQueryBuilder()
          .select(`us.*`)
          .addSelect(
            `date_trunc('day', us."lastViewAt" at time zone COALESCE(u.timezone, 'utc'))::date`,
            'lastViewAtTz',
          )
          .addSelect('u.timezone', 'timezone')
          .addSelect('u."coresRole"', 'coresRole')
          .addSelect('us.currentStreak', 'current')
          .addSelect('u."weekStart"', 'weekStart')
          .addSelect(
            'COALESCE(s."optOutStreakFreeze", false)',
            'optOutStreakFreeze',
          )
          .addSelect(
            `(date_trunc('day', usa."lastRecoverAt"::timestamptz at time zone COALESCE(u.timezone, 'utc'))::date) - interval '1 day'`,
            'lastRecoverAt',
          )
          .addSelect(`usf."lastFreezeAt"`, 'lastFreezeAt')
          .from(UserStreak, 'us')
          .innerJoin(User, 'u', 'u.id = us."userId"')
          .leftJoin(Settings, 's', 's."userId" = u.id')
          .leftJoin(
            (qb) =>
              qb
                .select('MAX(a."createdAt")', 'lastRecoverAt')
                .addSelect('a."userId"', 'userId')
                .from(UserStreakAction, 'a')
                .where(`a.type = :recoverType`, {
                  recoverType: UserStreakActionType.Recover,
                })
                .groupBy('a."userId"'),
            'usa',
            'usa."userId" = us."userId"',
          )
          .leftJoin(
            (qb) =>
              qb
                .select('MAX(a."createdAt")', 'lastFreezeAt')
                .addSelect('a."userId"', 'userId')
                .from(UserStreakAction, 'a')
                .where(`a.type = :freezeType`, {
                  freezeType: UserStreakActionType.Freeze,
                })
                .groupBy('a."userId"'),
            'usf',
            'usf."userId" = us."userId"',
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
                (date_trunc('day', usa."lastRecoverAt"::timestamptz at time zone COALESCE(u.timezone, 'utc'))::date)
                  <
                (date_trunc('day', now() at time zone COALESCE(u.timezone, 'utc'))::date)
              )
            )`,
          )
          .andWhere(
            `
            (
              usf."lastFreezeAt" IS NULL OR
              (
                usf."lastFreezeAt"::date
                  <
                (date_trunc('day', now() at time zone COALESCE(u.timezone, 'utc'))::date)
              )
            )`,
          )
          .getRawMany();

        const userIdsToReset: string[] = [];

        for (const row of usersPastStreakTime) {
          const { lastRecoverAt, lastFreezeAt, ...userStreak } = row;
          const lastActionTime = combineLastActionDates([
            lastRecoverAt,
            lastFreezeAt,
          ]);

          if (!checkUserStreak(userStreak, lastActionTime)) {
            continue;
          }

          const missedDays = getMissedStreakDays(userStreak, lastActionTime);
          const userFreezeEvents = await tryConsumeStreakFreeze(entityManager, {
            userId: userStreak.userId,
            currentStreak: userStreak.currentStreak,
            freezesAvailable: userStreak.freezesAvailable,
            optOutStreakFreeze: userStreak.optOutStreakFreeze,
            coresRole: userStreak.coresRole,
            missedDays,
          });

          if (userFreezeEvents) {
            freezeEvents.push(...userFreezeEvents);
          } else {
            userIdsToReset.push(userStreak.userId);
          }
        }

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
      await publishStreakFreezeEvents(freezeEvents);
      logger.info('updated current streak cron');
    } catch (err) {
      logger.error({ err }, 'failed to update current streak cron');
    }
  },
};

export default cron;
