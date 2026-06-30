import { Cron } from './cron';
import { User } from '../entity/user/User';
import { Achievement, AchievementEventType } from '../entity/Achievement';
import { syncUsersRetroactiveAchievements } from '../common/achievement/retroactive';
import { processStreamInBatches } from '../common/streaming';
import { SubscriptionStatus } from '../common/plus/subscription';
import { UserAchievement } from '../entity/user/UserAchievement';

const batchSize = 500;
const concurrency = 3;
const subscriptionMonthsExpression = `DATE_PART('year', AGE(NOW(), (u."subscriptionFlags"->>'createdAt')::timestamptz)) * 12 + DATE_PART('month', AGE(NOW(), (u."subscriptionFlags"->>'createdAt')::timestamptz))`;

export const subscriptionAnniversaryAchievementsCron: Cron = {
  name: 'subscription-anniversary-achievements',
  handler: async (con, logger) => {
    const stream = await con
      .getRepository(User)
      .createQueryBuilder('u')
      .select('u.id', 'userId')
      .distinct(true)
      .innerJoin(Achievement, 'a', 'a."eventType" = :eventType', {
        eventType: AchievementEventType.SubscriptionAnniversary,
      })
      .leftJoin(
        UserAchievement,
        'ua',
        'ua."userId" = u.id AND ua."achievementId" = a.id',
      )
      .where(`u."subscriptionFlags"->>'createdAt' IS NOT NULL`)
      .andWhere(`u."subscriptionFlags"->>'status' = :status`, {
        status: SubscriptionStatus.Active,
      })
      .andWhere(`${subscriptionMonthsExpression} > 0`)
      .andWhere(`ua."unlockedAt" IS NULL`)
      .andWhere(
        `(ua."achievementId" IS NULL OR ua.progress < ${subscriptionMonthsExpression})`,
      )
      .stream();

    await processStreamInBatches<{ userId: string }>(
      stream,
      async (batch) => {
        await con.transaction((manager) =>
          syncUsersRetroactiveAchievements({
            con: manager,
            logger,
            userIds: batch.map((row) => row.userId),
            eventTypes: [AchievementEventType.SubscriptionAnniversary],
          }),
        );
      },
      concurrency,
      batchSize,
    );
  },
};
