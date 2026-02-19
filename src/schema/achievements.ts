import { IResolvers } from '@graphql-tools/utils';
import { AuthenticationError, ForbiddenError } from 'apollo-server-errors';
import type { GraphQLResolveInfo } from 'graphql';
import type { EntityManager } from 'typeorm';
import { Context, BaseContext, type AuthContext } from '../Context';
import { syncUserRetroactiveAchievements } from '../common/achievement/retroactive';
import { queryReadReplica } from '../common/queryReadReplica';
import { updateFlagsStatement } from '../common/utils';
import { Achievement } from '../entity/Achievement';
import { User } from '../entity/user/User';
import type { UserFlags } from '../entity/user/User';
import { UserAchievement } from '../entity/user/UserAchievement';
import { ConflictError, NotFoundError } from '../errors';
import graphorm from '../graphorm';
import type { GQLEmptyResponse } from './common';
import { traceResolvers } from './trace';

const ACHIEVEMENT_SYNC_LIMIT = 1;
const CLOSE_ACHIEVEMENTS_LIMIT = 3;

const getAchievementSyncCount = (flags?: UserFlags): number => {
  return flags?.syncedAchievements ? 1 : 0;
};

const getSyncStatus = (syncCount: number): GQLAchievementSyncStatus => {
  const remainingSyncs = Math.max(0, ACHIEVEMENT_SYNC_LIMIT - syncCount);

  return {
    syncCount,
    remainingSyncs,
    canSync: remainingSyncs > 0,
    syncedAchievements: syncCount > 0,
  };
};

const getTargetCount = (achievement: Achievement): number => {
  return achievement.criteria.targetCount ?? 1;
};

const getUserAchievementsWithProgress = async ({
  con,
  userId,
}: {
  con: EntityManager;
  userId: string;
}): Promise<GQLUserAchievement[]> => {
  const achievements = await con.getRepository(Achievement).find({
    order: { createdAt: 'ASC' },
  });

  const userAchievements = await con.getRepository(UserAchievement).find({
    where: { userId },
  });

  const userAchievementMap = new Map(
    userAchievements.map((ua) => [ua.achievementId, ua]),
  );

  return achievements.map((achievement) => {
    const ua = userAchievementMap.get(achievement.id);
    return {
      achievement,
      progress: ua?.progress ?? 0,
      unlockedAt: ua?.unlockedAt ?? null,
      createdAt: ua?.createdAt ?? new Date(),
      updatedAt: ua?.updatedAt ?? new Date(),
    };
  });
};

export type GQLUserAchievement = {
  achievement: Achievement;
  progress: number;
  unlockedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type GQLUserAchievementStats = {
  totalAchievements: number;
  unlockedCount: number;
  lockedCount: number;
};

export type GQLAchievementSyncStatus = {
  syncCount: number;
  remainingSyncs: number;
  canSync: boolean;
  syncedAchievements: boolean;
};

export type GQLAchievementSyncResult = GQLAchievementSyncStatus & {
  pointsGained: number;
  totalPoints: number;
  newlyUnlockedAchievements: GQLUserAchievement[];
  closeAchievements: GQLUserAchievement[];
};

export const typeDefs = /* GraphQL */ `
  """
  Achievement type determines how progress is tracked
  """
  enum AchievementType {
    """
    One-time action (e.g., first profile picture)
    """
    instant
    """
    Requires consecutive days (e.g., 7-day streak)
    """
    streak
    """
    Cumulative count (e.g., upvote 100 posts)
    """
    milestone
    """
    Multiple sub-achievements to unlock
    """
    multipart
  }

  """
  Achievement criteria for unlocking
  """
  type AchievementCriteria {
    """
    Target count required to unlock (for milestone type)
    """
    targetCount: Int
  }

  """
  An achievement definition
  """
  type Achievement {
    """
    Unique achievement ID
    """
    id: ID!
    """
    Display name of the achievement
    """
    name: String!
    """
    Description of how to unlock
    """
    description: String!
    """
    URL to achievement badge/icon image
    """
    image: String!
    """
    Type of achievement (instant, streak, milestone, multipart)
    """
    type: AchievementType!
    """
    Criteria required to unlock this achievement
    """
    criteria: AchievementCriteria!
    """
    Points awarded for unlocking this achievement
    """
    points: Int!
    """
    Percentage of active users who unlocked this (null if not yet calculated)
    """
    rarity: Float
    """
    When the achievement was created
    """
    createdAt: DateTime!
  }

  """
  A user's progress on an achievement
  """
  type UserAchievement {
    """
    The achievement definition
    """
    achievement: Achievement!
    """
    Current progress towards unlocking (for milestone types)
    """
    progress: Int!
    """
    When the achievement was unlocked (null if not yet unlocked)
    """
    unlockedAt: DateTime
    """
    When the user started tracking this achievement
    """
    createdAt: DateTime!
    """
    When the progress was last updated
    """
    updatedAt: DateTime!
  }

  """
  Statistics about a user's achievements
  """
  type UserAchievementStats {
    """
    Total number of achievements available
    """
    totalAchievements: Int!
    """
    Number of achievements the user has unlocked
    """
    unlockedCount: Int!
    """
    Number of achievements not yet unlocked
    """
    lockedCount: Int!
  }

  """
  Current sync usage for the logged-in user
  """
  type AchievementSyncStatus {
    """
    Number of syncs already used
    """
    syncCount: Int!
    """
    Number of syncs remaining
    """
    remainingSyncs: Int!
    """
    Whether user can still run sync
    """
    canSync: Boolean!
    """
    Whether user has ever synced achievements
    """
    syncedAchievements: Boolean!
  }

  """
  Result of syncing achievements for logged-in user
  """
  type AchievementSyncResult {
    """
    Number of syncs already used
    """
    syncCount: Int!
    """
    Number of syncs remaining
    """
    remainingSyncs: Int!
    """
    Whether user can still run sync
    """
    canSync: Boolean!
    """
    Whether user has ever synced achievements
    """
    syncedAchievements: Boolean!
    """
    Points gained during this sync
    """
    pointsGained: Int!
    """
    Total unlocked achievement points after sync
    """
    totalPoints: Int!
    """
    Achievements unlocked by this sync run
    """
    newlyUnlockedAchievements: [UserAchievement!]!
    """
    In-progress achievements that are closest to unlocking
    """
    closeAchievements: [UserAchievement!]!
  }

  extend type Query {
    """
    Get all available achievements
    """
    achievements: [Achievement!]! @cacheControl(maxAge: 3600)

    """
    Get a user's achievements with progress
    """
    userAchievements(
      """
      User ID to get achievements for (defaults to current user)
      """
      userId: ID
    ): [UserAchievement!]!

    """
    Get achievement statistics for a user
    """
    userAchievementStats(
      """
      User ID to get stats for (defaults to current user)
      """
      userId: ID
    ): UserAchievementStats!

    """
    Get achievement sync status for current user
    """
    achievementSyncStatus: AchievementSyncStatus! @auth

    """
    Get the currently tracked achievement for current user.
    Returns null when no achievement is being tracked.
    """
    trackedAchievement: UserAchievement @auth
  }

  extend type Mutation {
    """
    Run retroactive achievement sync for current user
    """
    syncAchievements: AchievementSyncResult! @auth

    """
    Track a locked achievement for the current user.
    Tracking a new one replaces the previous tracked achievement.
    """
    trackAchievement(achievementId: ID!): UserAchievement! @auth

    """
    Stop tracking achievement for current user.
    """
    untrackAchievement: EmptyResponse! @auth
  }
`;

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    achievements: (_, __, ctx: Context, info: GraphQLResolveInfo) =>
      graphorm.query(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder.orderBy(`"${builder.alias}"."createdAt"`, 'ASC');
          return builder;
        },
        true,
      ),
    userAchievements: async (
      _,
      args: { userId?: string },
      ctx: Context,
    ): Promise<GQLUserAchievement[]> => {
      const userId = args.userId || ctx.userId;

      if (!userId) {
        throw new AuthenticationError(
          'You must provide a userId or be logged in',
        );
      }

      return queryReadReplica(ctx.con, ({ queryRunner }) =>
        getUserAchievementsWithProgress({
          con: queryRunner.manager,
          userId,
        }),
      );
    },
    userAchievementStats: async (
      _,
      args: { userId?: string },
      ctx: Context,
    ): Promise<GQLUserAchievementStats> => {
      const userId = args.userId || ctx.userId;

      if (!userId) {
        throw new AuthenticationError(
          'You must provide a userId or be logged in',
        );
      }

      const [totalAchievements, unlockedCount] = await queryReadReplica(
        ctx.con,
        ({ queryRunner }) =>
          Promise.all([
            queryRunner.manager.getRepository(Achievement).count(),
            queryRunner.manager
              .getRepository(UserAchievement)
              .createQueryBuilder('ua')
              .where('ua.userId = :userId', { userId })
              .andWhere('ua.unlockedAt IS NOT NULL')
              .getCount(),
          ]),
      );

      return {
        totalAchievements,
        unlockedCount,
        lockedCount: totalAchievements - unlockedCount,
      };
    },
    achievementSyncStatus: async (
      _,
      __,
      ctx: AuthContext,
    ): Promise<GQLAchievementSyncStatus> => {
      const user = await queryReadReplica(ctx.con, ({ queryRunner }) =>
        queryRunner.manager.getRepository(User).findOne({
          select: ['id', 'flags'],
          where: { id: ctx.userId },
        }),
      );

      if (!user) {
        throw new ForbiddenError('User not authenticated');
      }

      return getSyncStatus(getAchievementSyncCount(user.flags));
    },
    trackedAchievement: async (
      _,
      __,
      ctx: AuthContext,
    ): Promise<GQLUserAchievement | null> => {
      const user = await ctx.con.getRepository(User).findOne({
        select: ['id', 'flags'],
        where: { id: ctx.userId },
      });

      if (!user) {
        throw new ForbiddenError('User not authenticated');
      }

      const trackedAchievementId = user.flags?.trackedAchievementId;
      if (!trackedAchievementId) {
        return null;
      }

      const achievement = await ctx.con.getRepository(Achievement).findOne({
        where: { id: trackedAchievementId },
      });

      if (!achievement) {
        await ctx.con.getRepository(User).update(ctx.userId, {
          flags: updateFlagsStatement<User>({ trackedAchievementId: null }),
        });
        return null;
      }

      const userAchievement = await ctx.con
        .getRepository(UserAchievement)
        .findOne({
          where: { userId: ctx.userId, achievementId: trackedAchievementId },
        });

      if (userAchievement?.unlockedAt) {
        await ctx.con.getRepository(User).update(ctx.userId, {
          flags: updateFlagsStatement<User>({ trackedAchievementId: null }),
        });
        return null;
      }

      return {
        achievement,
        progress: userAchievement?.progress ?? 0,
        unlockedAt: null,
        createdAt: userAchievement?.createdAt ?? new Date(),
        updatedAt: userAchievement?.updatedAt ?? new Date(),
      };
    },
  },
  Mutation: {
    syncAchievements: async (
      _,
      __,
      ctx: AuthContext,
    ): Promise<GQLAchievementSyncResult> => {
      return ctx.con.transaction(async (manager) => {
        const user = await manager
          .getRepository(User)
          .createQueryBuilder('user')
          .setLock('pessimistic_write')
          .select(['user.id', 'user.flags'])
          .where('user.id = :userId', { userId: ctx.userId })
          .getOne();

        if (!user) {
          throw new ForbiddenError('User not authenticated');
        }

        const currentSyncCount = getAchievementSyncCount(user.flags);
        if (currentSyncCount >= ACHIEVEMENT_SYNC_LIMIT) {
          throw new ConflictError('You already used your achievement sync.');
        }

        const { unlockedAchievementIds } =
          await syncUserRetroactiveAchievements({
            con: manager,
            logger: ctx.log,
            userId: ctx.userId,
          });

        const nextSyncCount = currentSyncCount + 1;

        await manager.getRepository(User).update(ctx.userId, {
          flags: updateFlagsStatement<User>({
            syncedAchievements: true,
          }),
        });

        const achievements = await getUserAchievementsWithProgress({
          con: manager,
          userId: ctx.userId,
        });

        const unlockedAchievementIdsSet = new Set(unlockedAchievementIds);

        const newlyUnlockedAchievements = achievements
          .filter(
            ({ achievement, unlockedAt }) =>
              !!unlockedAt && unlockedAchievementIdsSet.has(achievement.id),
          )
          .sort((a, b) => a.achievement.points - b.achievement.points);

        const closeAchievements = achievements
          .filter(({ unlockedAt, progress }) => !unlockedAt && progress > 0)
          .sort((a, b) => {
            const ratioA = a.progress / getTargetCount(a.achievement);
            const ratioB = b.progress / getTargetCount(b.achievement);

            if (ratioB !== ratioA) {
              return ratioB - ratioA;
            }

            if (b.progress !== a.progress) {
              return b.progress - a.progress;
            }

            return b.achievement.points - a.achievement.points;
          })
          .slice(0, CLOSE_ACHIEVEMENTS_LIMIT);

        const pointsGained = newlyUnlockedAchievements.reduce(
          (total, achievement) => total + achievement.achievement.points,
          0,
        );

        const totalPoints = achievements.reduce(
          (total, achievement) =>
            total +
            (achievement.unlockedAt ? achievement.achievement.points : 0),
          0,
        );

        return {
          ...getSyncStatus(nextSyncCount),
          pointsGained,
          totalPoints,
          newlyUnlockedAchievements,
          closeAchievements,
        };
      });
    },
    trackAchievement: async (
      _,
      args: { achievementId: string },
      ctx: AuthContext,
    ): Promise<GQLUserAchievement> => {
      const achievement = await ctx.con.getRepository(Achievement).findOne({
        where: { id: args.achievementId },
      });

      if (!achievement) {
        throw new NotFoundError('Achievement not found');
      }

      const userAchievement = await ctx.con
        .getRepository(UserAchievement)
        .findOne({
          where: {
            userId: ctx.userId,
            achievementId: args.achievementId,
          },
        });

      if (userAchievement?.unlockedAt) {
        throw new ConflictError('Unlocked achievements cannot be tracked');
      }

      await ctx.con.getRepository(User).update(ctx.userId, {
        flags: updateFlagsStatement<User>({
          trackedAchievementId: args.achievementId,
        }),
      });

      return {
        achievement,
        progress: userAchievement?.progress ?? 0,
        unlockedAt: userAchievement?.unlockedAt ?? null,
        createdAt: userAchievement?.createdAt ?? new Date(),
        updatedAt: userAchievement?.updatedAt ?? new Date(),
      };
    },
    untrackAchievement: async (
      _,
      __,
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      await ctx.con.getRepository(User).update(ctx.userId, {
        flags: updateFlagsStatement<User>({
          trackedAchievementId: null,
        }),
      });

      return { _: true };
    },
  },
});
