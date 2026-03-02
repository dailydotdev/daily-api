import { FastifyBaseLogger } from 'fastify';
import {
  DataSource,
  EntityManager,
  In,
  LessThanOrEqual,
  MoreThan,
} from 'typeorm';
import { redisPubSub } from '../../redis';
import { Quest, QuestEventType } from '../../entity/Quest';
import { QuestRotation } from '../../entity/QuestRotation';
import { UserQuest, UserQuestStatus } from '../../entity/user/UserQuest';

type QuestTarget = {
  rotationId: string;
  targetCount: number;
};

type QuestUpdatePayload = {
  updatedAt: Date;
};

const TERMINAL_USER_QUEST_STATUSES = [
  UserQuestStatus.Completed,
  UserQuestStatus.Claimed,
] as const;

const toSafeTargetCount = (targetCount?: number): number =>
  Math.max(1, Math.floor(targetCount ?? 1));

const toSafeIncrement = (incrementBy: number): number =>
  Math.max(0, Math.floor(incrementBy));

const getQuestTargetsByEventType = async ({
  con,
  eventType,
  now,
}: {
  con: DataSource | EntityManager;
  eventType: QuestEventType;
  now: Date;
}): Promise<QuestTarget[]> => {
  const rotations = await con.getRepository(QuestRotation).find({
    where: {
      periodStart: LessThanOrEqual(now),
      periodEnd: MoreThan(now),
    },
  });

  if (!rotations.length) {
    return [];
  }

  const rotationByQuestId = rotations.reduce((map, rotation) => {
    const list = map.get(rotation.questId) ?? [];
    list.push(rotation.id);
    map.set(rotation.questId, list);
    return map;
  }, new Map<string, string[]>());

  const quests = await con.getRepository(Quest).find({
    where: {
      id: In(Array.from(rotationByQuestId.keys())),
      eventType,
      active: true,
    },
  });

  const questTargets: QuestTarget[] = [];

  for (const quest of quests) {
    const rotationIds = rotationByQuestId.get(quest.id) ?? [];
    if (!rotationIds.length) {
      continue;
    }

    const targetCount = toSafeTargetCount(quest.criteria?.targetCount);

    for (const rotationId of rotationIds) {
      questTargets.push({
        rotationId,
        targetCount,
      });
    }
  }

  return questTargets;
};

export const publishQuestUpdate = async ({
  logger,
  userId,
  updatedAt = new Date(),
}: {
  logger: FastifyBaseLogger;
  userId: string;
  updatedAt?: Date;
}): Promise<void> => {
  const payload: QuestUpdatePayload = { updatedAt };

  try {
    await redisPubSub.publish(`events.quests.${userId}.update`, payload);
  } catch (error) {
    logger.error(
      {
        error,
        userId,
      },
      'Failed to publish quest update',
    );
  }
};

const updateExistingUserQuestProgress = async ({
  con,
  userId,
  target,
  safeIncrement,
  now,
}: {
  con: DataSource | EntityManager;
  userId: string;
  target: QuestTarget;
  safeIncrement: number;
  now: Date;
}): Promise<boolean> => {
  const boundedProgressExpression =
    'least(:targetCount, greatest(0, "progress") + :safeIncrement)';

  const updateResult = await con
    .createQueryBuilder()
    .update(UserQuest)
    .set({
      progress: () => boundedProgressExpression,
      status: () =>
        `CASE WHEN ${boundedProgressExpression} >= :targetCount THEN :completedStatus ELSE :inProgressStatus END`,
      completedAt: () =>
        `CASE WHEN ${boundedProgressExpression} >= :targetCount THEN coalesce("completedAt", :now) ELSE NULL END`,
    })
    .where('"rotationId" = :rotationId', { rotationId: target.rotationId })
    .andWhere('"userId" = :userId', { userId })
    .andWhere('"status" NOT IN (:...terminalStatuses)', {
      terminalStatuses: TERMINAL_USER_QUEST_STATUSES,
    })
    .andWhere('"progress" < :targetCount')
    .setParameters({
      targetCount: target.targetCount,
      safeIncrement,
      completedStatus: UserQuestStatus.Completed,
      inProgressStatus: UserQuestStatus.InProgress,
      now,
    })
    .execute();

  return (updateResult.affected ?? 0) > 0;
};

const insertNewUserQuestProgress = async ({
  con,
  userId,
  target,
  safeIncrement,
  now,
}: {
  con: DataSource | EntityManager;
  userId: string;
  target: QuestTarget;
  safeIncrement: number;
  now: Date;
}): Promise<boolean> => {
  const progress = Math.min(target.targetCount, safeIncrement);
  const status =
    progress >= target.targetCount
      ? UserQuestStatus.Completed
      : UserQuestStatus.InProgress;
  const completedAt = status === UserQuestStatus.Completed ? now : null;

  const insertResult = await con
    .createQueryBuilder()
    .insert()
    .into(UserQuest)
    .values({
      rotationId: target.rotationId,
      userId,
      progress,
      status,
      completedAt,
      claimedAt: null,
    })
    .returning(['id'])
    .orIgnore()
    .execute();

  return Boolean(insertResult.generatedMaps?.[0]?.id);
};

export const checkQuestProgress = async ({
  con,
  logger,
  userId,
  eventType,
  incrementBy = 1,
  now = new Date(),
}: {
  con: DataSource | EntityManager;
  logger: FastifyBaseLogger;
  userId: string;
  eventType: QuestEventType;
  incrementBy?: number;
  now?: Date;
}): Promise<boolean> => {
  const safeIncrement = toSafeIncrement(incrementBy);
  if (!safeIncrement) {
    return false;
  }

  try {
    const targets = await getQuestTargetsByEventType({
      con,
      eventType,
      now,
    });

    if (!targets.length) {
      return false;
    }

    let didUpdate = false;

    for (const target of targets) {
      const didUpdateExisting = await updateExistingUserQuestProgress({
        con,
        userId,
        target,
        safeIncrement,
        now,
      });

      if (didUpdateExisting) {
        didUpdate = true;
        continue;
      }

      const didInsertNew = await insertNewUserQuestProgress({
        con,
        userId,
        target,
        safeIncrement,
        now,
      });

      if (didInsertNew) {
        didUpdate = true;
        continue;
      }

      // A concurrent event can insert between update and insert; retrying update applies this increment.
      const didUpdateAfterConflict = await updateExistingUserQuestProgress({
        con,
        userId,
        target,
        safeIncrement,
        now,
      });

      didUpdate = didUpdate || didUpdateAfterConflict;
    }

    if (didUpdate) {
      await publishQuestUpdate({
        logger,
        userId,
        updatedAt: now,
      });
    }

    return didUpdate;
  } catch (error) {
    logger.error(
      {
        error,
        userId,
        eventType,
        incrementBy: safeIncrement,
      },
      'Failed to check quest progress',
    );
    throw error;
  }
};
