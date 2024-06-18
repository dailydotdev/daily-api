import { IResolvers } from '@graphql-tools/utils';
import { Context } from '../Context';
import { traceResolvers } from './trace';
import { GQLUser } from './users';
import { User, UserStats, UserStreak } from '../entity';
import { DataSource, In, Not } from 'typeorm';
import { getLimit } from '../common';

// TODO: Rename this file

export type GQLUserLeaderboard = {
  score: number;
  user: GQLUser | Promise<GQLUser>;
};

export const typeDefs = /* GraphQL */ `
  type Leaderboard {
    score: Int
    user: User
  }

  extend type Query {
    """
    Get the users with the highest reputation
    """
    highestReputation(
      """
      Limit the number of users returned
      """
      limit: Int
    ): [Leaderboard] @cacheControl(maxAge: 600)

    """
    Get the users with the longest streak
    """
    longestStreak(
      """
      Limit the number of users returned
      """
      limit: Int
    ): [Leaderboard] @cacheControl(maxAge: 600)

    """
    Get the users with the highest post views
    """
    highestPostViews(
      """
      Limit the number of users returned
      """
      limit: Int
    ): [Leaderboard] @cacheControl(maxAge: 600)

    """
    Get the users with the most upvotes
    """
    mostUpvoted(
      """
      Limit the number of users returned
      """
      limit: Int
    ): [Leaderboard] @cacheControl(maxAge: 600)

    """
    Get the users with the most referrals
    """
    mostReferrals(
      """
      Limit the number of users returned
      """
      limit: Int
    ): [Leaderboard] @cacheControl(maxAge: 600)

    """
    Get the users with the most reading days
    """
    mostReadingDays(
      """
      Limit the number of users returned
      """
      limit: Int
    ): [Leaderboard] @cacheControl(maxAge: 600)
  }
`;

const getUserLeaderboardForStat = async ({
  con,
  stat,
  limit,
}: {
  con: DataSource;
  stat: keyof Omit<UserStats, 'id'> | ((alias: string) => string);
  limit: number;
}): Promise<GQLUserLeaderboard[]> => {
  const statSelect = typeof stat === 'function' ? stat('us') : `us.${stat}`;

  const users = await con
    .createQueryBuilder()
    .from(UserStats, 'us')
    .select('u.*')
    .addSelect(statSelect, 'score')
    .leftJoin(User, 'u', 'u.id = us.id')
    .orderBy('score', 'DESC')
    .limit(limit)
    .getRawMany<
      User & {
        score: number;
      }
    >();

  return users.map(({ score, ...user }) => {
    return {
      score,
      user: user,
    };
  });
};

export const resolvers: IResolvers<unknown, Context> = traceResolvers({
  Query: {
    highestReputation: async (_, args, ctx): Promise<GQLUserLeaderboard[]> => {
      const users = await ctx.con.getRepository(User).find({
        where: {
          id: Not(In(['404'])),
        },
        order: { reputation: 'DESC' },
        take: getLimit(args),
      });

      return users.map((user) => ({ score: user.reputation, user }));
    },
    longestStreak: async (_, args, ctx): Promise<GQLUserLeaderboard[]> => {
      const users = await ctx.con.getRepository(UserStreak).find({
        where: {
          user: {
            id: Not(In(['404'])),
          },
        },
        order: { currentStreak: 'DESC' },
        take: getLimit(args),
        relations: ['user'],
      });

      return users.map((user) => ({
        score: user.currentStreak,
        user: user.user,
      }));
    },
    highestPostViews: async (_, args, ctx): Promise<GQLUserLeaderboard[]> => {
      return getUserLeaderboardForStat({
        con: ctx.con,
        stat: 'views',
        limit: getLimit(args),
      });
    },
    mostUpvoted: async (_, args, ctx): Promise<GQLUserLeaderboard[]> => {
      return getUserLeaderboardForStat({
        con: ctx.con,
        stat: 'postUpvotes',
        limit: getLimit(args),
      });
    },
    mostReferrals: async (_, args, ctx): Promise<GQLUserLeaderboard[]> => {
      return getUserLeaderboardForStat({
        con: ctx.con,
        stat: 'referrals',
        limit: getLimit(args),
      });
    },
    mostReadingDays: async (_, args, ctx): Promise<GQLUserLeaderboard[]> => {
      const users = await ctx.con.getRepository(UserStreak).find({
        where: {
          user: {
            id: Not(In(['404'])),
          },
        },
        order: { totalStreak: 'DESC' },
        take: getLimit(args),
        relations: ['user'],
      });

      return users.map((user) => ({
        score: user.totalStreak,
        user: user.user,
      }));
    },
  },
});
