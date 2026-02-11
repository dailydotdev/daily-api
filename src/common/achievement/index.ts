import type { DataSource, EntityManager } from 'typeorm';
import { FastifyBaseLogger } from 'fastify';
import {
  Achievement,
  AchievementEventType,
  AchievementType,
} from '../../entity/Achievement';
import { UserAchievement } from '../../entity/user/UserAchievement';
import { triggerTypedEvent } from '../typedPubsub';

export {
  AchievementEventType,
  AchievementType,
} from '../../entity/Achievement';

type AchievementConnection = DataSource | EntityManager;

/**
 * Get achievements by eventType - fast indexed lookup
 */
export async function getAchievementsByEventType(
  con: AchievementConnection,
  eventType: AchievementEventType,
): Promise<Achievement[]> {
  return con
    .getRepository(Achievement)
    .createQueryBuilder('a')
    .where('a.eventType = :eventType', { eventType })
    .orderBy("a.criteria->>'targetCount'", 'ASC')
    .getMany();
}

/**
 * Get or create a user achievement record
 */
export async function getOrCreateUserAchievement(
  con: AchievementConnection,
  userId: string,
  achievementId: string,
): Promise<UserAchievement> {
  const repo = con.getRepository(UserAchievement);

  let userAchievement = await repo.findOne({
    where: { userId, achievementId },
  });

  if (!userAchievement) {
    userAchievement = repo.create({
      userId,
      achievementId,
      progress: 0,
      unlockedAt: null,
    });
    await repo.save(userAchievement);
  }

  return userAchievement;
}

/**
 * Update user achievement progress and check if it should be unlocked
 * Returns true if the achievement was newly unlocked
 */
export async function updateUserAchievementProgress(
  con: AchievementConnection,
  logger: FastifyBaseLogger,
  userId: string,
  achievementId: string,
  progress: number,
  targetCount: number,
): Promise<boolean> {
  const repo = con.getRepository(UserAchievement);

  const userAchievement = await getOrCreateUserAchievement(
    con,
    userId,
    achievementId,
  );

  // Already unlocked, no need to update
  if (userAchievement.unlockedAt) {
    return false;
  }

  const shouldUnlock = progress >= targetCount;
  const updateData: Partial<UserAchievement> = {
    progress,
    updatedAt: new Date(),
  };

  if (shouldUnlock) {
    updateData.unlockedAt = new Date();
  }

  await repo.update({ achievementId, userId }, updateData);

  return shouldUnlock;
}

/**
 * Increment user achievement progress by a given amount
 * Returns true if the achievement was newly unlocked
 */
export async function incrementUserAchievementProgress(
  con: AchievementConnection,
  logger: FastifyBaseLogger,
  userId: string,
  achievementId: string,
  targetCount: number,
  incrementBy: number = 1,
): Promise<boolean> {
  const userAchievement = await getOrCreateUserAchievement(
    con,
    userId,
    achievementId,
  );

  // Already unlocked, no need to update
  if (userAchievement.unlockedAt) {
    return false;
  }

  const newProgress = userAchievement.progress + incrementBy;
  return updateUserAchievementProgress(
    con,
    logger,
    userId,
    achievementId,
    newProgress,
    targetCount,
  );
}

/**
 * Evaluates and updates achievements for instant type (one-time actions)
 */
async function evaluateInstantAchievement(
  con: AchievementConnection,
  logger: FastifyBaseLogger,
  userId: string,
  achievements: Achievement[],
): Promise<void> {
  for (const achievement of achievements) {
    const targetCount = achievement.criteria.targetCount ?? 1;
    const wasUnlocked = await updateUserAchievementProgress(
      con,
      logger,
      userId,
      achievement.id,
      1, // Instant achievements are always complete with 1 action
      targetCount,
    );

    if (wasUnlocked) {
      logger.info(
        { achievementId: achievement.id, userId, name: achievement.name },
        'Achievement unlocked',
      );
      await triggerTypedEvent(logger, 'api.v1.achievement-unlocked', {
        achievementId: achievement.id,
        userId,
      });
    }
  }
}

/**
 * Evaluates and updates achievements for milestone type (counting actions)
 */
async function evaluateMilestoneAchievement(
  con: AchievementConnection,
  logger: FastifyBaseLogger,
  userId: string,
  achievements: Achievement[],
  incrementBy: number = 1,
): Promise<void> {
  for (const achievement of achievements) {
    const targetCount = achievement.criteria.targetCount ?? 1;
    const wasUnlocked = await incrementUserAchievementProgress(
      con,
      logger,
      userId,
      achievement.id,
      targetCount,
      incrementBy,
    );

    if (wasUnlocked) {
      logger.info(
        { achievementId: achievement.id, userId, name: achievement.name },
        'Achievement unlocked',
      );
      await triggerTypedEvent(logger, 'api.v1.achievement-unlocked', {
        achievementId: achievement.id,
        userId,
      });
    }
  }
}

/**
 * Evaluates achievements using absolute value comparison (reputation, streaks, etc.)
 */
async function evaluateAbsoluteValueAchievement(
  con: AchievementConnection,
  logger: FastifyBaseLogger,
  userId: string,
  achievements: Achievement[],
  currentValue: number,
): Promise<void> {
  for (const achievement of achievements) {
    const targetCount = achievement.criteria.targetCount ?? 1;
    const wasUnlocked = await updateUserAchievementProgress(
      con,
      logger,
      userId,
      achievement.id,
      currentValue,
      targetCount,
    );

    if (wasUnlocked) {
      logger.info(
        { achievementId: achievement.id, userId, name: achievement.name },
        'Achievement unlocked',
      );
      await triggerTypedEvent(logger, 'api.v1.achievement-unlocked', {
        achievementId: achievement.id,
        userId,
      });
    }
  }
}

/**
 * Evaluator type for achievement progress checking
 */
type AchievementEvaluator = (
  con: AchievementConnection,
  logger: FastifyBaseLogger,
  userId: string,
  achievements: Achievement[],
  currentValue?: number,
) => Promise<void>;

/**
 * Get the appropriate evaluator based on achievement type
 */
function getEvaluator(type: AchievementType): AchievementEvaluator {
  switch (type) {
    case AchievementType.Instant:
      return evaluateInstantAchievement;
    case AchievementType.Milestone:
      return evaluateMilestoneAchievement;
    default:
      // Default to milestone for future types
      return evaluateMilestoneAchievement;
  }
}

/**
 * Core function to check and update achievement progress
 * Uses eventType to efficiently find relevant achievements
 */
export async function checkAchievementProgress(
  con: AchievementConnection,
  logger: FastifyBaseLogger,
  userId: string,
  eventType: AchievementEventType,
  currentValue?: number,
): Promise<void> {
  try {
    // Get all achievements for this event type
    const achievements = await getAchievementsByEventType(con, eventType);

    if (achievements.length === 0) {
      return;
    }

    const absoluteValueEventTypes: AchievementEventType[] = [
      AchievementEventType.ReputationGain,
    ];

    if (absoluteValueEventTypes.includes(eventType)) {
      await evaluateAbsoluteValueAchievement(
        con,
        logger,
        userId,
        achievements,
        currentValue ?? 0,
      );
      return;
    }

    // Group achievements by type for proper evaluation
    const achievementsByType = achievements.reduce(
      (acc, achievement) => {
        const type = achievement.type as AchievementType;
        if (!acc[type]) {
          acc[type] = [];
        }
        acc[type].push(achievement);
        return acc;
      },
      {} as Record<AchievementType, Achievement[]>,
    );

    // Evaluate each group with the appropriate evaluator
    for (const [type, typeAchievements] of Object.entries(achievementsByType)) {
      const evaluator = getEvaluator(type as AchievementType);
      await evaluator(con, logger, userId, typeAchievements, currentValue);
    }
  } catch (error) {
    logger.error(
      { error, userId, eventType },
      'Error checking achievement progress',
    );
    // Don't throw - achievement failures shouldn't block the main operation
  }
}
