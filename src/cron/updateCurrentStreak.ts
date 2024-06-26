import { Cron } from './cron';
import { User, UserStreak } from '../entity';
import { checkAndClearUserStreak } from '../common';

const cron: Cron = {
  name: 'update-current-streak',
  handler: async (con, logger) => {
    console.log('opened cron');
    try {
      await con.transaction(async (entityManager): Promise<void> => {
        const usersPastStreakTime = await entityManager
          .createQueryBuilder()
          .select(
            `us.*, (date_trunc('day', us."lastViewAt" at time zone COALESCE(u.timezone, 'utc'))::date) AS "lastViewAtTz", u.timezone`,
          )
          .from(UserStreak, 'us')
          .innerJoin(User, 'u', 'u.id = us."userId"')
          .where(`us."currentStreak" != 0`)
          .andWhere(
            `(date_trunc('day', us. "lastViewAt" at time zone COALESCE(u.timezone, 'utc'))::date) < (date_trunc('day', now() at time zone COALESCE(u.timezone, 'utc'))::date) - interval '1 day' `,
          )
          .getRawMany();

        await Promise.all(
          usersPastStreakTime.map(async (userStreak) => {
            return await checkAndClearUserStreak(
              entityManager,
              null,
              userStreak,
            );
          }),
        );
      });
      logger.info('updated current streak cron');
    } catch (err) {
      logger.error({ err }, 'failed to update current streak cron');
    }
  },
};

export default cron;
