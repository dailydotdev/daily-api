import '../src/config';
import { In } from 'typeorm';
import createOrGetConnection from '../src/db';
import { Achievement, AchievementEventType, UserStreak } from '../src/entity';
import { updateUserAchievementProgress } from '../src/common/achievement';
import { logger } from '../src/logger';

/**
 * One-off backfill to retroactively unlock the newly added reading streak
 * achievements for users whose max streak already qualifies.
 * Idempotent: updateUserAchievementProgress skips already-unlocked achievements.
 */

const NEW_ACHIEVEMENT_NAMES = ['What time is it?', 'Devil is impressed'];

const start = async (): Promise<void> => {
  const con = await createOrGetConnection();

  try {
    const achievements = await con.getRepository(Achievement).find({
      where: {
        eventType: AchievementEventType.ReadingStreak,
        name: In(NEW_ACHIEVEMENT_NAMES),
      },
    });

    const foundNames = new Set(achievements.map(({ name }) => name));
    const missing = NEW_ACHIEVEMENT_NAMES.filter(
      (name) => !foundNames.has(name),
    );
    if (missing.length > 0) {
      throw new Error(
        `Missing reading streak achievements: ${missing.join(', ')}. Run migrations first.`,
      );
    }

    const minTarget = Math.min(
      ...achievements.map(({ criteria }) => criteria.targetCount ?? 1),
    );

    const streaks = await con
      .getRepository(UserStreak)
      .createQueryBuilder('us')
      .select(['us.userId', 'us.maxStreak'])
      .where('us.maxStreak >= :minTarget', { minTarget })
      .getMany();

    console.log(
      `Found ${streaks.length} users with maxStreak >= ${minTarget} and ${achievements.length} target achievements.`,
    );

    let totalUnlocked = 0;

    for (const { userId, maxStreak } of streaks) {
      for (const achievement of achievements) {
        const wasUnlocked = await updateUserAchievementProgress(
          con,
          logger,
          userId,
          achievement.id,
          maxStreak,
          achievement.criteria.targetCount ?? 1,
        );

        if (wasUnlocked) {
          totalUnlocked++;
        }
      }
    }

    console.log(
      `Finished reading streak achievements backfill. Unlocked ${totalUnlocked} achievements.`,
    );
  } finally {
    await con.destroy();
  }
};

start()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
