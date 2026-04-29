import { FastifyBaseLogger } from 'fastify';
import {
  DataSource,
  EntityManager,
  In,
  LessThanOrEqual,
  MoreThan,
} from 'typeorm';
import { redisPubSub } from '../../redis';
import { Quest, QuestEventType, QuestType } from '../../entity/Quest';
import { QuestRotation } from '../../entity/QuestRotation';
import { User } from '../../entity/user/User';
import { UserQuest, UserQuestStatus } from '../../entity/user/UserQuest';
import { syncMilestoneQuestProgress } from './milestone';

type QuestTarget = {
  rotationId: string;
  targetCount: number;
  type: QuestType;
};

type QuestProgressUpdateResult = {
  didUpdate: boolean;
  didComplete: boolean;
};

type QuestUpdatePayload = {
  updatedAt: Date;
};

type QuestRotationUpdatePayload = {
  updatedAt: Date;
  type: QuestType;
  periodStart: Date;
  periodEnd: Date;
};

export const QUEST_ROTATION_UPDATE_CHANNEL = 'events.quests.rotation.update';

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
      type: In([QuestType.Daily, QuestType.Weekly, QuestType.Intro]),
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
        type: quest.type,
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

export const publishQuestRotationUpdate = async ({
  logger,
  type,
  periodStart,
  periodEnd,
  updatedAt = new Date(),
}: {
  logger: FastifyBaseLogger;
  type: QuestType;
  periodStart: Date;
  periodEnd: Date;
  updatedAt?: Date;
}): Promise<void> => {
  const payload: QuestRotationUpdatePayload = {
    updatedAt,
    type,
    periodStart,
    periodEnd,
  };

  try {
    await redisPubSub.publish(QUEST_ROTATION_UPDATE_CHANNEL, payload);
  } catch (error) {
    logger.error(
      {
        error,
        type,
        periodStart,
        periodEnd,
      },
      'Failed to publish quest rotation update',
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
}): Promise<QuestProgressUpdateResult> => {
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
    .returning(['status'])
    .setParameters({
      targetCount: target.targetCount,
      safeIncrement,
      completedStatus: UserQuestStatus.Completed,
      inProgressStatus: UserQuestStatus.InProgress,
      now,
    })
    .execute();

  const didUpdate = (updateResult.affected ?? 0) > 0;

  return {
    didUpdate,
    didComplete:
      didUpdate &&
      updateResult.raw.some(
        ({ status }: { status?: UserQuestStatus }) =>
          status === UserQuestStatus.Completed,
      ),
  };
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
}): Promise<QuestProgressUpdateResult> => {
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

  const didUpdate = Boolean(insertResult.generatedMaps?.[0]?.id);

  return {
    didUpdate,
    didComplete: didUpdate && status === UserQuestStatus.Completed,
  };
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

  if (!userId) {
    return false;
  }

  const userExists = await con.getRepository(User).exists({
    where: { id: userId },
  });

  if (!userExists) {
    return false;
  }

  try {
    const targets = await getQuestTargetsByEventType({
      con,
      eventType,
      now,
    });

    let didUpdate = false;
    let didCompleteQuest = false;

    for (const target of targets) {
      const updateExistingResult = await updateExistingUserQuestProgress({
        con,
        userId,
        target,
        safeIncrement,
        now,
      });

      if (updateExistingResult.didUpdate) {
        didUpdate = true;
        didCompleteQuest = didCompleteQuest || updateExistingResult.didComplete;
        continue;
      }

      if (target.type === QuestType.Intro) {
        continue;
      }

      const insertNewResult = await insertNewUserQuestProgress({
        con,
        userId,
        target,
        safeIncrement,
        now,
      });

      if (insertNewResult.didUpdate) {
        didUpdate = true;
        didCompleteQuest = didCompleteQuest || insertNewResult.didComplete;
        continue;
      }

      // A concurrent event can insert between update and insert; retrying update applies this increment.
      const updateAfterConflictResult = await updateExistingUserQuestProgress({
        con,
        userId,
        target,
        safeIncrement,
        now,
      });

      didUpdate = didUpdate || updateAfterConflictResult.didUpdate;
      didCompleteQuest =
        didCompleteQuest || updateAfterConflictResult.didComplete;
    }

    const didUpdateMilestones = await syncMilestoneQuestProgress({
      con,
      userId,
      eventType,
      now,
    });

    didUpdate = didUpdate || didUpdateMilestones;

    if (didCompleteQuest && eventType !== QuestEventType.QuestComplete) {
      const didUpdateQuestCompletionMilestones =
        await syncMilestoneQuestProgress({
          con,
          userId,
          eventType: QuestEventType.QuestComplete,
          now,
        });

      didUpdate = didUpdate || didUpdateQuestCompletionMilestones;
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
