import type { DataSource, EntityManager } from 'typeorm';
import { In, LessThanOrEqual, MoreThan } from 'typeorm';
import { Comment } from '../../entity/Comment';
import { Quest, QuestEventType, QuestType } from '../../entity/Quest';
import { QuestRotation } from '../../entity/QuestRotation';
import { View } from '../../entity/View';
import { ContentPreference } from '../../entity/contentPreference/ContentPreference';
import {
  ContentPreferenceStatus,
  ContentPreferenceType,
} from '../../entity/contentPreference/types';
import { Post } from '../../entity/posts/Post';
import { User } from '../../entity/user/User';
import { UserComment } from '../../entity/user/UserComment';
import { UserPost } from '../../entity/user/UserPost';
import { UserQuest, UserQuestStatus } from '../../entity/user/UserQuest';
import { UserVote } from '../../types';

const claimedQuestStatuses = [UserQuestStatus.Claimed];

const rotatingQuestTypes = [QuestType.Daily, QuestType.Weekly];

const toSafeTargetCount = (targetCount?: number): number =>
  Math.max(1, Math.floor(targetCount ?? 1));

const toSafeProgress = (progress: number): number =>
  Math.max(0, Math.floor(progress));

const getFollowerGainCount = async ({
  con,
  userId,
}: {
  con: DataSource | EntityManager;
  userId: string;
}): Promise<number> =>
  con.getRepository(ContentPreference).count({
    where: {
      referenceId: userId,
      type: ContentPreferenceType.User,
      status: In([
        ContentPreferenceStatus.Follow,
        ContentPreferenceStatus.Subscribed,
      ]),
    },
  });

const getReferralCount = async ({
  con,
  userId,
}: {
  con: DataSource | EntityManager;
  userId: string;
}): Promise<number> =>
  con.getRepository(User).count({
    where: {
      referralId: userId,
    },
  });

const getArticleReadCount = async ({
  con,
  userId,
}: {
  con: DataSource | EntityManager;
  userId: string;
}): Promise<number> => {
  const result = await con
    .getRepository(View)
    .createQueryBuilder('view')
    .select('COUNT(DISTINCT view."postId")', 'count')
    .where('view."userId" = :userId', { userId })
    .getRawOne<{ count: string | number | null }>();

  return Number(result?.count) || 0;
};

const getQuestCompleteCount = async ({
  con,
  userId,
}: {
  con: DataSource | EntityManager;
  userId: string;
}): Promise<number> => {
  const result = await con
    .getRepository(UserQuest)
    .createQueryBuilder('uq')
    .innerJoin(QuestRotation, 'rotation', 'rotation.id = uq."rotationId"')
    .select('COUNT(*)', 'count')
    .where('uq."userId" = :userId', { userId })
    .andWhere('uq.status IN (:...statuses)', {
      statuses: claimedQuestStatuses,
    })
    .andWhere('rotation.type IN (:...types)', {
      types: rotatingQuestTypes,
    })
    .getRawOne<{ count: string | number | null }>();

  return Number(result?.count) || 0;
};

const getUpvoteReceivedCount = async ({
  con,
  userId,
}: {
  con: DataSource | EntityManager;
  userId: string;
}): Promise<number> => {
  const [postResult, commentResult] = await Promise.all([
    con
      .getRepository(UserPost)
      .createQueryBuilder('up')
      .innerJoin(Post, 'post', 'post.id = up."postId"')
      .select('COUNT(*)', 'count')
      .where('post."authorId" = :userId', { userId })
      .andWhere('up.vote = :upvote', { upvote: UserVote.Up })
      .andWhere('up."userId" != post."authorId"')
      .getRawOne<{ count: string | number | null }>(),
    con
      .getRepository(UserComment)
      .createQueryBuilder('uc')
      .innerJoin(Comment, 'comment', 'comment.id = uc."commentId"')
      .select('COUNT(*)', 'count')
      .where('comment."userId" = :userId', { userId })
      .andWhere('uc.vote = :upvote', { upvote: UserVote.Up })
      .andWhere('uc."userId" != comment."userId"')
      .getRawOne<{ count: string | number | null }>(),
  ]);

  return (Number(postResult?.count) || 0) + (Number(commentResult?.count) || 0);
};

const getMilestoneQuestCurrentValue = async ({
  con,
  userId,
  eventType,
}: {
  con: DataSource | EntityManager;
  userId: string;
  eventType: QuestEventType;
}): Promise<number> => {
  switch (eventType) {
    case QuestEventType.BriefRead:
      return getArticleReadCount({ con, userId });
    case QuestEventType.FollowerGain:
      return getFollowerGainCount({ con, userId });
    case QuestEventType.ReferralCount:
      return getReferralCount({ con, userId });
    case QuestEventType.QuestComplete:
      return getQuestCompleteCount({ con, userId });
    case QuestEventType.UpvoteReceived:
      return getUpvoteReceivedCount({ con, userId });
    default:
      return 0;
  }
};

export const syncMilestoneQuestProgress = async ({
  con,
  userId,
  now = new Date(),
  eventType,
}: {
  con: DataSource | EntityManager;
  userId: string;
  now?: Date;
  eventType?: QuestEventType;
}): Promise<boolean> => {
  const rotations = await con.getRepository(QuestRotation).find({
    where: {
      type: QuestType.Milestone,
      periodStart: LessThanOrEqual(now),
      periodEnd: MoreThan(now),
    },
    order: {
      slot: 'ASC',
      createdAt: 'ASC',
      id: 'ASC',
    },
  });

  if (!rotations.length) {
    return false;
  }

  const quests = await con.getRepository(Quest).find({
    where: {
      id: In(rotations.map(({ questId }) => questId)),
      type: QuestType.Milestone,
      active: true,
      ...(eventType ? { eventType } : {}),
    },
    order: {
      createdAt: 'ASC',
      id: 'ASC',
    },
  });

  if (!quests.length) {
    return false;
  }

  const rotationByQuestId = new Map(
    rotations.map((rotation) => [rotation.questId, rotation]),
  );
  const relevantRotationIds = quests
    .map(({ id }) => rotationByQuestId.get(id)?.id)
    .filter((rotationId): rotationId is string => !!rotationId);

  const existingUserQuests = relevantRotationIds.length
    ? await con.getRepository(UserQuest).find({
        where: {
          userId,
          rotationId: In(relevantRotationIds),
        },
      })
    : [];

  const existingQuestByRotationId = new Map(
    existingUserQuests.map((userQuest) => [userQuest.rotationId, userQuest]),
  );
  const currentValueByEventType = new Map<QuestEventType, number>();

  let didUpdate = false;

  for (const quest of quests) {
    const rotation = rotationByQuestId.get(quest.id);
    if (!rotation) {
      continue;
    }

    if (!currentValueByEventType.has(quest.eventType)) {
      currentValueByEventType.set(
        quest.eventType,
        await getMilestoneQuestCurrentValue({
          con,
          userId,
          eventType: quest.eventType,
        }),
      );
    }

    const currentValue = currentValueByEventType.get(quest.eventType) ?? 0;
    const targetCount = toSafeTargetCount(quest.criteria?.targetCount);
    const existingUserQuest = existingQuestByRotationId.get(rotation.id);
    const terminalProgress =
      existingUserQuest?.status === UserQuestStatus.Completed ||
      existingUserQuest?.status === UserQuestStatus.Claimed ||
      !!existingUserQuest?.completedAt ||
      !!existingUserQuest?.claimedAt
        ? targetCount
        : 0;
    const nextProgress = Math.min(
      targetCount,
      Math.max(
        terminalProgress,
        toSafeProgress(existingUserQuest?.progress ?? 0),
        toSafeProgress(currentValue),
      ),
    );
    const isCompleted = nextProgress >= targetCount;
    const nextStatus =
      existingUserQuest?.status === UserQuestStatus.Claimed
        ? UserQuestStatus.Claimed
        : isCompleted
          ? UserQuestStatus.Completed
          : UserQuestStatus.InProgress;
    const nextCompletedAt =
      existingUserQuest?.completedAt ?? (isCompleted ? now : null);

    if (existingUserQuest) {
      const shouldUpdate =
        existingUserQuest.progress !== nextProgress ||
        existingUserQuest.status !== nextStatus ||
        existingUserQuest.completedAt?.getTime() !== nextCompletedAt?.getTime();

      if (!shouldUpdate) {
        continue;
      }

      await con.getRepository(UserQuest).update(
        {
          id: existingUserQuest.id,
        },
        {
          progress: nextProgress,
          status: nextStatus,
          completedAt: nextCompletedAt,
        },
      );

      didUpdate = true;
      continue;
    }

    await con.getRepository(UserQuest).insert({
      rotationId: rotation.id,
      userId,
      progress: nextProgress,
      status: nextStatus,
      completedAt: nextCompletedAt,
      claimedAt: null,
    });

    didUpdate = true;
  }

  return didUpdate;
};
