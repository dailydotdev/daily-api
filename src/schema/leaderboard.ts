import { IResolvers } from '@graphql-tools/utils';
import { Context } from '../Context';
import { traceResolvers } from './trace';
import { GQLUser } from './users';
import { User } from '../entity';

// TODO: Rename this file

export const typeDefs = /* GraphQL */ `
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
  }
`;

export const resolvers: IResolvers<unknown, Context> = traceResolvers({
  Query: {
    highestReputation: async (_, args, ctx): Promise<GQLUser[]> => {
      return ctx.con
        .createQueryBuilder()
        .select('u')
        .from(User, 'u')
        .orderBy('u.reputation', 'DESC')
        .limit(args.limit)
        .getMany();
    },
  },
});
