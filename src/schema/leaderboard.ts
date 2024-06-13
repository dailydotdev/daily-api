import { IResolvers } from '@graphql-tools/utils';
import { Context } from '../Context';
import { traceResolvers } from './trace';
import { GQLUser } from './users';
import { User, UserStreak } from '../entity';

// TODO: Rename this file

export const typeDefs = /* GraphQL */ `
  type HighestUserStreak {
    currentStreak: Int
    totalStreak: Int
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
    ): [User] @cacheControl(maxAge: 600)

    """
    Get the users with the longest streak
    """
    longestStreak(
      """
      Limit the number of users returned
      """
      limit: Int
    ): [HighestUserStreak] @cacheControl(maxAge: 600)

    """
    Get the users with the most reading days
    """
    mostReadingDays(
      """
      Limit the number of users returned
      """
      limit: Int
    ): [HighestUserStreak] @cacheControl(maxAge: 600)
  }
`;

export const resolvers: IResolvers<unknown, Context> = traceResolvers({
  Query: {
    highestReputation: async (_, args, ctx): Promise<GQLUser[]> => {
      return ctx.con.getRepository(User).find({
        order: { reputation: 'DESC' },
        take: args.limit,
      });
    },
    longestStreak: async (_, args, ctx) => {
      return await ctx.con.getRepository(UserStreak).find({
        order: { currentStreak: 'DESC' },
        take: args.limit,
        relations: ['user'],
      });
    },
    mostReadingDays: async (_, args, ctx) => {
      return await ctx.con.getRepository(UserStreak).find({
        order: { totalStreak: 'DESC' },
        take: args.limit,
        relations: ['user'],
      });
    },
  },
});
