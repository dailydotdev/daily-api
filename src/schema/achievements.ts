import { IResolvers } from '@graphql-tools/utils';
import { BaseContext, type AuthContext } from '../Context';
import { traceResolvers } from './trace';
import {
  Achievement,
  AchievementType,
  AchievementEventType,
} from '../entity/Achievement';
import { UserAchievement } from '../entity/user/UserAchievement';
import { ForbiddenError } from 'apollo-server-errors';

export type GQLAchievement = {
  id: string;
  name: string;
  description: string;
  image: string;
  type: AchievementType;
  eventType: AchievementEventType;
  criteria: {
    targetCount?: number;
  };
  points: number;
  createdAt: Date;
};

export type GQLUserAchievement = {
  achievement: GQLAchievement | Promise<GQLAchievement>;
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
    ): [UserAchievement!]! @auth

    """
    Get achievement statistics for a user
    """
    userAchievementStats(
      """
      User ID to get stats for (defaults to current user)
      """
      userId: ID
    ): UserAchievementStats! @auth
  }
`;

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    achievements: async (_, __, ctx): Promise<GQLAchievement[]> => {
      const achievements = await ctx.con.getRepository(Achievement).find({
        order: { createdAt: 'ASC' },
      });

      return achievements;
    },
    userAchievements: async (
      _,
      args: { userId?: string },
      ctx: AuthContext,
    ): Promise<GQLUserAchievement[]> => {
      const userId = args.userId || ctx.userId;

      if (!userId) {
        throw new ForbiddenError('User not authenticated');
      }

      // If viewing another user's achievements, ensure we only return unlocked ones
      const isOwnProfile = userId === ctx.userId;

      // Get all achievements
      const achievements = await ctx.con.getRepository(Achievement).find({
        order: { createdAt: 'ASC' },
      });

      // Get user's progress on achievements
      const userAchievements = await ctx.con
        .getRepository(UserAchievement)
        .find({
          where: { userId },
          relations: ['achievement'],
        });

      const userAchievementMap = new Map(
        userAchievements.map((ua) => [ua.achievementId, ua]),
      );

      // Return all achievements with user progress
      const results: GQLUserAchievement[] = [];

      for (const achievement of achievements) {
        const userAchievement = userAchievementMap.get(achievement.id);

        // For other users, only show unlocked achievements
        if (!isOwnProfile && !userAchievement?.unlockedAt) {
          continue;
        }

        results.push({
          achievement: {
            id: achievement.id,
            name: achievement.name,
            description: achievement.description,
            image: achievement.image,
            type: achievement.type,
            eventType: achievement.eventType,
            criteria: achievement.criteria,
            points: achievement.points,
            createdAt: achievement.createdAt,
          },
          progress: userAchievement?.progress ?? 0,
          unlockedAt: userAchievement?.unlockedAt ?? null,
          createdAt: userAchievement?.createdAt ?? new Date(),
          updatedAt: userAchievement?.updatedAt ?? new Date(),
        });
      }

      return results;
    },
    userAchievementStats: async (
      _,
      args: { userId?: string },
      ctx: AuthContext,
    ): Promise<GQLUserAchievementStats> => {
      const userId = args.userId || ctx.userId;

      if (!userId) {
        throw new ForbiddenError('User not authenticated');
      }

      const [totalAchievements, unlockedCount] = await Promise.all([
        ctx.con.getRepository(Achievement).count(),
        ctx.con
          .getRepository(UserAchievement)
          .createQueryBuilder('ua')
          .where('ua.userId = :userId', { userId })
          .andWhere('ua.unlockedAt IS NOT NULL')
          .getCount(),
      ]);

      return {
        totalAchievements,
        unlockedCount,
        lockedCount: totalAchievements - unlockedCount,
      };
    },
  },
});
