import { Cron } from './cron';
import { Achievement } from '../entity/Achievement';
import { UserAchievement } from '../entity/user/UserAchievement';

const cron: Cron = {
  name: 'update-achievement-rarity',
  handler: async (con, logger) => {
    const totalUsersResult = await con
      .getRepository(UserAchievement)
      .createQueryBuilder('ua')
      .select('COUNT(DISTINCT ua."userId")', 'cnt')
      .where('ua."unlockedAt" IS NOT NULL')
      .getRawOne<{ cnt: string }>();

    const totalUsers = parseInt(totalUsersResult?.cnt ?? '0', 10);

    if (totalUsers === 0) {
      logger.info('No users with unlocked achievements, skipping rarity update');
      return;
    }

    const achievementCounts = await con
      .getRepository(UserAchievement)
      .createQueryBuilder('ua')
      .select('ua."achievementId"', 'achievementId')
      .addSelect('COUNT(DISTINCT ua."userId")', 'cnt')
      .where('ua."unlockedAt" IS NOT NULL')
      .groupBy('ua."achievementId"')
      .getRawMany<{ achievementId: string; cnt: string }>();

    const updates = achievementCounts.map(({ achievementId, cnt }) => ({
      id: achievementId,
      rarity: (parseInt(cnt, 10) / totalUsers) * 100,
    }));

    if (updates.length > 0) {
      await con.transaction(async (manager) => {
        for (const { id, rarity } of updates) {
          await manager.getRepository(Achievement).update(id, { rarity });
        }
      });
    }

    logger.info(
      { totalUsers, achievementCount: updates.length },
      'Achievement rarity updated',
    );
  },
};

export default cron;
