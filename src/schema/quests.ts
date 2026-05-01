import { IResolvers } from '@graphql-tools/utils';
import { ForbiddenError, ValidationError } from 'apollo-server-errors';
import { randomUUID } from 'crypto';
import { In, LessThanOrEqual, MoreThan, type EntityManager } from 'typeorm';
import { AuthContext, BaseContext, SubscriptionContext } from '../Context';
import {
  calculateCurrentQuestStreak,
  calculateLongestQuestStreak,
  checkQuestProgress,
  getQuestLevelState,
  publishQuestUpdate,
  QUEST_ROTATION_UPDATE_CHANNEL,
  syncMilestoneQuestProgress,
} from '../common/quest';
import { transferCores } from '../common/njord';
import { systemUser } from '../common/utils';
import {
  Quest,
  QuestEventType,
  QuestReward,
  QuestRewardType,
  QuestRotation,
  QuestType,
  User,
} from '../entity';
import { UserQuest, UserQuestProfile, UserQuestStatus } from '../entity/user';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
} from '../entity/user/UserTransaction';
import { NotFoundError } from '../errors';
import { redisPubSub } from '../redis';
import { GQLEmptyResponse } from './common';

type GQLQuestLevel = ReturnType<typeof getQuestLevelState>;

type GQLUserQuest = {
  userQuestId: string | null;
  rotationId: string;
  isPlusSlot: boolean;
  progress: number;
  status: UserQuestStatus;
  completedAt: Date | null;
  claimedAt: Date | null;
  locked: boolean;
  claimable: boolean;
  quest: Quest;
  rewards: QuestReward[];
};

type GQLQuestBucket = {
  regular: GQLUserQuest[];
  plus: GQLUserQuest[];
};

type GQLQuestDashboard = {
  level: GQLQuestLevel;
  currentStreak: number;
  longestStreak: number;
  hasNewQuestRotations: boolean;
  daily: GQLQuestBucket;
  weekly: GQLQuestBucket;
  milestone: GQLUserQuest[];
  intro: GQLUserQuest[];
};

type GQLClaimQuestRewardPayload = Pick<
  GQLQuestDashboard,
  'level' | 'daily' | 'weekly' | 'milestone' | 'intro'
>;

type GQLQuestUpdate = {
  updatedAt: Date;
};

type GQLQuestRotationUpdate = {
  updatedAt: Date;
  type: QuestType;
  periodStart: Date;
  periodEnd: Date;
};

type QuestRewardTotals = {
  xp: number;
  reputation: number;
  cores: number;
};

const DEFAULT_QUEST_STATUS = UserQuestStatus.InProgress;
const CLIENT_TRACKABLE_QUEST_EVENT_TYPES = new Set<QuestEventType>([
  QuestEventType.VisitArena,
  QuestEventType.VisitExplorePage,
  QuestEventType.VisitDiscussionsPage,
  QuestEventType.VisitReadItLaterPage,
  QuestEventType.ViewUserProfile,
]);

const toQuestBucket = (quests: GQLUserQuest[]): GQLQuestBucket => ({
  regular: quests.filter((quest) => !quest.isPlusSlot),
  plus: quests.filter((quest) => quest.isPlusSlot),
});

const toQuestRewardTotals = (rewards: QuestReward[]): QuestRewardTotals =>
  rewards.reduce<QuestRewardTotals>(
    (totals, reward) => {
      const amount = Math.max(0, Math.floor(reward.amount));

      switch (reward.type) {
        case QuestRewardType.XP:
          totals.xp += amount;
          return totals;
        case QuestRewardType.Reputation:
          totals.reputation += amount;
          return totals;
        case QuestRewardType.Cores:
          totals.cores += amount;
          return totals;
        default:
          throw new Error(`Unsupported quest reward type: ${reward.type}`);
      }
    },
    {
      xp: 0,
      reputation: 0,
      cores: 0,
    },
  );

const getCurrentUserQuestsByType = async ({
  con,
  userId,
  type,
  isPlus,
  now,
}: {
  con: EntityManager;
  userId: string;
  type: QuestType;
  isPlus: boolean;
  now: Date;
}): Promise<GQLUserQuest[]> => {
  const rotations = await con.getRepository(QuestRotation).find({
    where: {
      type,
      periodStart: LessThanOrEqual(now),
      periodEnd: MoreThan(now),
    },
    order: {
      plusOnly: 'ASC',
      slot: 'ASC',
      createdAt: 'ASC',
    },
  });

  if (rotations.length === 0) {
    return [];
  }

  if (type === QuestType.Milestone) {
    await syncMilestoneQuestProgress({
      con,
      userId,
      now,
    });
  }

  const rotationIds = rotations.map(({ id }) => id);
  const questIds = [...new Set(rotations.map(({ questId }) => questId))];

  const [quests, rewards, userQuests] = await Promise.all([
    con.getRepository(Quest).find({
      where: {
        id: In(questIds),
      },
    }),
    con.getRepository(QuestReward).find({
      where: {
        questId: In(questIds),
      },
    }),
    con.getRepository(UserQuest).find({
      where: {
        userId,
        rotationId: In(rotationIds),
      },
    }),
  ]);

  const questById = new Map(quests.map((quest) => [quest.id, quest]));
  const userQuestByRotationId = new Map(
    userQuests.map((quest) => [quest.rotationId, quest]),
  );
  const rewardsByQuestId = rewards.reduce((map, reward) => {
    const list = map.get(reward.questId) ?? [];
    list.push(reward);
    map.set(reward.questId, list);
    return map;
  }, new Map<string, QuestReward[]>());

  return rotations
    .map((rotation) => {
      const quest = questById.get(rotation.questId);
      if (!quest) {
        return null;
      }

      const userQuest = userQuestByRotationId.get(rotation.id);
      if (type === QuestType.Intro && !userQuest) {
        return null;
      }

      const status = userQuest?.status ?? DEFAULT_QUEST_STATUS;
      const locked = rotation.plusOnly && !isPlus;

      return {
        userQuestId: userQuest?.id ?? null,
        rotationId: rotation.id,
        isPlusSlot: rotation.plusOnly,
        progress: userQuest?.progress ?? 0,
        status,
        completedAt: userQuest?.completedAt ?? null,
        claimedAt: userQuest?.claimedAt ?? null,
        locked,
        claimable: !locked && status === UserQuestStatus.Completed,
        quest,
        rewards: rewardsByQuestId.get(quest.id) ?? [],
      };
    })
    .filter((quest): quest is GQLUserQuest => !!quest);
};

const getQuestStreaks = async ({
  con,
  userId,
  now,
}: {
  con: EntityManager;
  userId: string;
  now: Date;
}): Promise<Pick<GQLQuestDashboard, 'currentStreak' | 'longestStreak'>> => {
  const completedDayExpression = `DATE(uq."completedAt" AT TIME ZONE 'utc')`;
  const completionRows = await con
    .getRepository(UserQuest)
    .createQueryBuilder('uq')
    .select(`DISTINCT ${completedDayExpression}`, 'completedDay')
    .where('uq."userId" = :userId', { userId })
    .andWhere('uq."completedAt" IS NOT NULL')
    .andWhere('uq.status IN (:...completedStatuses)', {
      completedStatuses: [UserQuestStatus.Completed, UserQuestStatus.Claimed],
    })
    .orderBy(completedDayExpression, 'DESC')
    .getRawMany<{ completedDay: string | Date | null }>();

  const completedDays = completionRows.map(({ completedDay }) => completedDay);

  return {
    currentStreak: calculateCurrentQuestStreak({
      completedDays,
      now,
    }),
    longestStreak: calculateLongestQuestStreak({
      completedDays,
    }),
  };
};

const getLatestActiveQuestRotationCreatedAt = async ({
  con,
  now,
}: {
  con: EntityManager;
  now: Date;
}): Promise<Date | null> => {
  const result = await con
    .getRepository(QuestRotation)
    .createQueryBuilder('rotation')
    .select('MAX(rotation."createdAt")', 'latestCreatedAt')
    .where('rotation."periodStart" <= :now', { now })
    .andWhere('rotation."periodEnd" > :now', { now })
    .getRawOne<{ latestCreatedAt: Date | string | null }>();

  if (!result?.latestCreatedAt) {
    return null;
  }

  const latestCreatedAt = new Date(result.latestCreatedAt);

  return Number.isNaN(latestCreatedAt.getTime()) ? null : latestCreatedAt;
};

const getQuestDashboard = async ({
  con,
  userId,
  isPlus,
  now,
}: {
  con: EntityManager;
  userId: string;
  isPlus: boolean;
  now: Date;
}): Promise<GQLQuestDashboard> => {
  const [
    profile,
    dailyQuests,
    weeklyQuests,
    milestoneQuests,
    introQuests,
    streaks,
    latestActiveQuestRotationCreatedAt,
  ] = await Promise.all([
    con.getRepository(UserQuestProfile).findOne({
      where: {
        userId,
      },
    }),
    getCurrentUserQuestsByType({
      con,
      userId,
      type: QuestType.Daily,
      isPlus,
      now,
    }),
    getCurrentUserQuestsByType({
      con,
      userId,
      type: QuestType.Weekly,
      isPlus,
      now,
    }),
    getCurrentUserQuestsByType({
      con,
      userId,
      type: QuestType.Milestone,
      isPlus,
      now,
    }),
    getCurrentUserQuestsByType({
      con,
      userId,
      type: QuestType.Intro,
      isPlus,
      now,
    }),
    getQuestStreaks({
      con,
      userId,
      now,
    }),
    getLatestActiveQuestRotationCreatedAt({
      con,
      now,
    }),
  ]);

  return {
    level: getQuestLevelState(profile?.totalXp ?? 0),
    ...streaks,
    hasNewQuestRotations:
      !!latestActiveQuestRotationCreatedAt &&
      (!profile?.lastViewedQuestRotationsAt ||
        profile.lastViewedQuestRotationsAt <
          latestActiveQuestRotationCreatedAt),
    daily: toQuestBucket(dailyQuests),
    weekly: toQuestBucket(weeklyQuests),
    milestone: milestoneQuests,
    intro: introQuests,
  };
};

const saveQuestRotationsViewedAt = async ({
  con,
  userId,
  now,
}: {
  con: EntityManager;
  userId: string;
  now: Date;
}): Promise<void> => {
  await con
    .createQueryBuilder()
    .insert()
    .into(UserQuestProfile)
    .values({
      userId,
      lastViewedQuestRotationsAt: now,
    })
    .orUpdate(['lastViewedQuestRotationsAt'], ['userId'])
    .execute();
};

const getClaimQuestRewardPayload = async ({
  con,
  userId,
  isPlus,
  now,
}: {
  con: EntityManager;
  userId: string;
  isPlus: boolean;
  now: Date;
}): Promise<GQLClaimQuestRewardPayload> => {
  const [profile, dailyQuests, weeklyQuests, milestoneQuests, introQuests] =
    await Promise.all([
      con.getRepository(UserQuestProfile).findOne({
        where: {
          userId,
        },
      }),
      getCurrentUserQuestsByType({
        con,
        userId,
        type: QuestType.Daily,
        isPlus,
        now,
      }),
      getCurrentUserQuestsByType({
        con,
        userId,
        type: QuestType.Weekly,
        isPlus,
        now,
      }),
      getCurrentUserQuestsByType({
        con,
        userId,
        type: QuestType.Milestone,
        isPlus,
        now,
      }),
      getCurrentUserQuestsByType({
        con,
        userId,
        type: QuestType.Intro,
        isPlus,
        now,
      }),
    ]);

  return {
    level: getQuestLevelState(profile?.totalXp ?? 0),
    daily: toQuestBucket(dailyQuests),
    weekly: toQuestBucket(weeklyQuests),
    milestone: milestoneQuests,
    intro: introQuests,
  };
};

const applyQuestRewards = async ({
  con,
  ctx,
  questId,
  userQuestId,
  questName,
  rewards,
}: {
  con: EntityManager;
  ctx: AuthContext;
  questId: string;
  userQuestId: string;
  questName: string;
  rewards: QuestReward[];
}): Promise<void> => {
  const rewardTotals = toQuestRewardTotals(rewards);

  if (rewardTotals.xp > 0) {
    await con
      .createQueryBuilder()
      .insert()
      .into(UserQuestProfile)
      .values({
        userId: ctx.userId,
        totalXp: 0,
      })
      .orIgnore()
      .execute();

    await con
      .createQueryBuilder()
      .update(UserQuestProfile)
      .set({
        totalXp: () => `"totalXp" + ${rewardTotals.xp}`,
      })
      .where({
        userId: ctx.userId,
      })
      .execute();
  }

  if (rewardTotals.reputation > 0) {
    await con
      .createQueryBuilder()
      .update(User)
      .set({
        reputation: () =>
          `greatest(0, reputation + ${rewardTotals.reputation})`,
      })
      .where({
        id: ctx.userId,
      })
      .execute();
  }

  if (rewardTotals.cores > 0) {
    const userTransaction = con.getRepository(UserTransaction).create({
      id: randomUUID(),
      processor: UserTransactionProcessor.Njord,
      receiverId: ctx.userId,
      status: UserTransactionStatus.Success,
      productId: null,
      senderId: systemUser.id,
      value: rewardTotals.cores,
      valueIncFees: rewardTotals.cores,
      fee: 0,
      request: ctx.requestMeta ?? {},
      flags: {
        note: `Quest reward: ${questName}`,
      },
      referenceId: questId,
      referenceType: `quest_reward:${userQuestId}`,
    });

    await con.getRepository(UserTransaction).save(userTransaction);

    await transferCores({
      ctx,
      transaction: userTransaction,
      entityManager: con,
    });
  }
};

const claimQuestReward = async ({
  con,
  ctx,
  userQuestId,
  now,
}: {
  con: EntityManager;
  ctx: AuthContext;
  userQuestId: string;
  now: Date;
}): Promise<void> => {
  const userQuest = await con.getRepository(UserQuest).findOne({
    where: {
      id: userQuestId,
      userId: ctx.userId,
    },
    lock: {
      mode: 'pessimistic_write',
    },
  });

  if (!userQuest) {
    throw new NotFoundError('Quest not found');
  }

  if (userQuest.status === UserQuestStatus.Claimed || userQuest.claimedAt) {
    throw new ValidationError('Quest reward was already claimed');
  }

  if (userQuest.status !== UserQuestStatus.Completed) {
    throw new ValidationError('Quest is not completed yet');
  }

  const rotation = await con.getRepository(QuestRotation).findOne({
    where: {
      id: userQuest.rotationId,
    },
  });

  if (!rotation) {
    throw new NotFoundError('Quest rotation not found');
  }

  if (rotation.periodStart > now || rotation.periodEnd <= now) {
    throw new ValidationError('Quest can no longer be claimed');
  }

  if (rotation.plusOnly && !ctx.isPlus) {
    throw new ForbiddenError('Quest reward requires Plus');
  }

  const quest = await con.getRepository(Quest).findOne({
    where: {
      id: rotation.questId,
    },
  });

  if (!quest) {
    throw new NotFoundError('Quest not found');
  }

  const rewards = await con.getRepository(QuestReward).find({
    where: {
      questId: quest.id,
    },
  });

  await applyQuestRewards({
    con,
    ctx,
    questId: quest.id,
    userQuestId: userQuest.id,
    questName: quest.name,
    rewards,
  });

  await con.getRepository(UserQuest).update(
    {
      id: userQuest.id,
    },
    {
      status: UserQuestStatus.Claimed,
      claimedAt: now,
    },
  );
};

export const typeDefs = /* GraphQL */ `
  enum QuestType {
    daily
    weekly
    milestone
    intro
  }

  enum QuestStatus {
    in_progress
    completed
    claimed
  }

  enum QuestRewardType {
    xp
    reputation
    cores
  }

  type QuestReward {
    type: QuestRewardType!
    amount: Int!
  }

  type QuestDefinition {
    id: ID!
    name: String!
    description: String!
    type: QuestType!
    eventType: String!
    targetCount: Int!
  }

  type UserQuest {
    userQuestId: ID
    rotationId: ID!
    progress: Int!
    status: QuestStatus!
    completedAt: DateTime
    claimedAt: DateTime
    locked: Boolean!
    claimable: Boolean!
    quest: QuestDefinition!
    rewards: [QuestReward!]!
  }

  type QuestBucket {
    regular: [UserQuest!]!
    plus: [UserQuest!]!
  }

  type QuestLevel {
    level: Int!
    totalXp: Int!
    xpInLevel: Int!
    xpToNextLevel: Int!
  }

  type QuestDashboard {
    level: QuestLevel!
    currentStreak: Int!
    longestStreak: Int!
    hasNewQuestRotations: Boolean!
    daily: QuestBucket!
    weekly: QuestBucket!
    milestone: [UserQuest!]!
    intro: [UserQuest!]!
  }

  type ClaimQuestRewardPayload {
    level: QuestLevel!
    daily: QuestBucket!
    weekly: QuestBucket!
    milestone: [UserQuest!]!
    intro: [UserQuest!]!
  }

  type QuestUpdate {
    updatedAt: DateTime!
  }

  type QuestRotationUpdate {
    updatedAt: DateTime!
    type: QuestType!
    periodStart: DateTime!
    periodEnd: DateTime!
  }

  enum ClientQuestEventType {
    visit_arena
    visit_explore_page
    visit_discussions_page
    visit_read_it_later_page
    view_user_profile
  }

  extend type Query {
    questDashboard: QuestDashboard! @auth
  }

  extend type Mutation {
    claimQuestReward(userQuestId: ID!): ClaimQuestRewardPayload! @auth
    markQuestRotationsViewed: EmptyResponse! @auth
    trackQuestEvent(eventType: ClientQuestEventType!): EmptyResponse! @auth
  }

  extend type Subscription {
    questUpdate: QuestUpdate! @auth
    questRotationUpdate: QuestRotationUpdate! @auth
  }
`;

export const resolvers: IResolvers<unknown, BaseContext> = {
  Query: {
    questDashboard: async (
      _,
      __,
      ctx: AuthContext,
    ): Promise<GQLQuestDashboard> => {
      const now = new Date();

      return getQuestDashboard({
        con: ctx.con.manager,
        userId: ctx.userId,
        isPlus: ctx.isPlus,
        now,
      });
    },
  },
  Mutation: {
    claimQuestReward: async (
      _,
      { userQuestId }: { userQuestId: string },
      ctx: AuthContext,
    ): Promise<GQLClaimQuestRewardPayload> => {
      const now = new Date();
      const dashboard = await ctx.con.transaction(async (con) => {
        await claimQuestReward({
          con,
          ctx,
          userQuestId,
          now,
        });

        await syncMilestoneQuestProgress({
          con,
          userId: ctx.userId,
          eventType: QuestEventType.QuestComplete,
          now,
        });

        return getClaimQuestRewardPayload({
          con,
          userId: ctx.userId,
          isPlus: ctx.isPlus,
          now,
        });
      });

      await publishQuestUpdate({
        logger: ctx.log,
        userId: ctx.userId,
        updatedAt: now,
      });

      return dashboard;
    },
    markQuestRotationsViewed: async (
      _,
      __,
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      await saveQuestRotationsViewedAt({
        con: ctx.con.manager,
        userId: ctx.userId,
        now: new Date(),
      });

      return {
        _: true,
      };
    },
    trackQuestEvent: async (
      _,
      { eventType }: { eventType: QuestEventType },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      if (!CLIENT_TRACKABLE_QUEST_EVENT_TYPES.has(eventType)) {
        throw new ValidationError('Quest event cannot be tracked directly');
      }

      await checkQuestProgress({
        con: ctx.con.manager,
        logger: ctx.log,
        userId: ctx.userId,
        eventType,
      });

      return {
        _: true,
      };
    },
  },
  Subscription: {
    questUpdate: {
      subscribe: async (
        _,
        __,
        ctx: SubscriptionContext,
      ): Promise<AsyncIterable<{ questUpdate: GQLQuestUpdate }>> => {
        const iterator = redisPubSub.asyncIterator<GQLQuestUpdate>(
          `events.quests.${ctx.userId}.update`,
        );

        return {
          [Symbol.asyncIterator]() {
            return {
              next: async () => {
                const { done, value } = await iterator.next();
                if (done) {
                  return { done: true, value: undefined };
                }
                return { done: false, value: { questUpdate: value } };
              },
              return: async () => {
                await iterator.return?.();
                return { done: true, value: undefined };
              },
              throw: async (error: Error) => {
                await iterator.throw?.(error);
                return { done: true, value: undefined };
              },
            };
          },
        };
      },
    },
    questRotationUpdate: {
      subscribe: async (): Promise<
        AsyncIterable<{ questRotationUpdate: GQLQuestRotationUpdate }>
      > => {
        const iterator = redisPubSub.asyncIterator<GQLQuestRotationUpdate>(
          QUEST_ROTATION_UPDATE_CHANNEL,
        );

        return {
          [Symbol.asyncIterator]() {
            return {
              next: async () => {
                const { done, value } = await iterator.next();
                if (done) {
                  return { done: true, value: undefined };
                }
                return {
                  done: false,
                  value: { questRotationUpdate: value },
                };
              },
              return: async () => {
                await iterator.return?.();
                return { done: true, value: undefined };
              },
              throw: async (error: Error) => {
                await iterator.throw?.(error);
                return { done: true, value: undefined };
              },
            };
          },
        };
      },
    },
  },
  QuestDefinition: {
    targetCount: (source: Quest) => source.criteria?.targetCount ?? 1,
  },
};
