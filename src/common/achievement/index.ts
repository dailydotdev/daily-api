import { DataSource } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { FastifyBaseLogger } from 'fastify';
import {
  Achievement,
  AchievementEventType,
  AchievementType,
} from '../../entity/Achievement';
import { User } from '../../entity/user/User';
import { UserAchievement } from '../../entity/user/UserAchievement';
import { updateFlagsStatement } from '../utils';
import { triggerTypedEvent } from '../typedPubsub';

export {
  AchievementEventType,
  AchievementType,
} from '../../entity/Achievement';

type AchievementConnection = DataSource | EntityManager;

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

export async function updateUserAchievementProgress(
  con: AchievementConnection,
  _logger: FastifyBaseLogger,
  userId: string,
  achievementId: string,
  progress: number,
  targetCount: number,
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

  const shouldUnlock = progress >= targetCount;
  const updateData: Partial<UserAchievement> = {
    progress,
    updatedAt: new Date(),
  };

  if (shouldUnlock) {
    updateData.unlockedAt = new Date();
  }

  const withTransaction = (
    callback: (manager: EntityManager) => Promise<void>,
  ) => (con instanceof DataSource ? con.transaction(callback) : callback(con));

  await withTransaction(async (manager) => {
    await manager
      .getRepository(UserAchievement)
      .update({ achievementId, userId }, updateData);

    if (shouldUnlock) {
      const user = await manager.getRepository(User).findOne({
        select: ['id', 'flags'],
        where: { id: userId },
      });

      if (user?.flags?.trackedAchievementId === achievementId) {
        await manager.getRepository(User).update(userId, {
          flags: updateFlagsStatement<User>({
            trackedAchievementId: null,
          }),
        });
      }
    }
  });

  return shouldUnlock;
}

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

type AchievementEvaluator = (
  con: AchievementConnection,
  logger: FastifyBaseLogger,
  userId: string,
  achievements: Achievement[],
  currentValue?: number,
) => Promise<void>;

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

export async function checkAchievementProgress(
  con: AchievementConnection,
  logger: FastifyBaseLogger,
  userId: string,
  eventType: AchievementEventType,
  currentValue?: number,
): Promise<void> {
  try {
    const achievements = await getAchievementsByEventType(con, eventType);

    if (achievements.length === 0) {
      return;
    }

    const absoluteValueEventTypes: AchievementEventType[] = [
      AchievementEventType.ReputationGain,
      AchievementEventType.ReadingStreak,
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
