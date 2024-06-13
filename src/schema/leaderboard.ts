import { IResolvers } from '@graphql-tools/utils';
import { Context } from '../Context';
import { traceResolvers } from './trace';
import { GQLUser } from './users';
import { User, UserStreak } from '../entity';

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

export const resolvers: IResolvers<unknown, Context> = traceResolvers({
  Query: {
    highestReputation: async (_, args, ctx): Promise<GQLUserLeaderboard[]> => {
      const users = await ctx.con.getRepository(User).find({
        order: { reputation: 'DESC' },
        take: args.limit,
      });

      return users.map((user) => ({ score: user.reputation, user }));
    },
    longestStreak: async (_, args, ctx): Promise<GQLUserLeaderboard[]> => {
      const users = await ctx.con.getRepository(UserStreak).find({
        order: { currentStreak: 'DESC' },
        take: args.limit,
        relations: ['user'],
      });

      return users.map((user) => ({
        score: user.currentStreak,
        user: user.user,
      }));
    },
    highestPostViews: async (_, args, ctx): Promise<GQLUserLeaderboard[]> => {
      // TODO: Implement this
      return;
    },
    mostUpvoted: async (_, args, ctx): Promise<GQLUserLeaderboard[]> => {
      // TODO: Implement this
      return;
    },
    mostReferrals: async (_, args, ctx): Promise<GQLUserLeaderboard[]> => {
      const subQuery = ctx.con
        .createQueryBuilder()
        .select('u.referralId', 'referralId')
        .addSelect('COUNT(u.referralId)', 'refferalCount')
        .from(User, 'u')
        .where('u.referralId IS NOT NULL')
        .groupBy('u.referralId')
        .orderBy('"refferalCount"', 'DESC')
        .limit(args.limit);

      const users = await ctx.con
        .createQueryBuilder()
        .select('u.*', 'user')
        .addSelect('referrals."refferalCount"', 'refferalCount')
        .from(User, 'u')
        .innerJoin(
          `(${subQuery.getQuery()})`,
          'referrals',
          'u.id = referrals."referralId"',
        )
        .setParameters(subQuery.getParameters())
        .getRawMany();

      return users.map((user) => ({
        score: user.refferalCount,
        user,
      }));
    },
    mostReadingDays: async (_, args, ctx): Promise<GQLUserLeaderboard[]> => {
      const users = await ctx.con.getRepository(UserStreak).find({
        order: { totalStreak: 'DESC' },
        take: args.limit,
        relations: ['user'],
      });

      return users.map((user) => ({
        score: user.totalStreak,
        user: user.user,
      }));
    },
  },
});
