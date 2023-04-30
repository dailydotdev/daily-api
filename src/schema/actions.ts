import { UserAction, ActionType } from '../entity';

import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import { GQLEmptyResponse } from './common';
import graphorm from '../graphorm';

type GQLUserAction = Pick<UserAction, 'userId' | 'type' | 'completedAt'>;

interface CompleteActionParams {
  type: ActionType;
}

export const typeDefs = /* GraphQL */ `
  """
  Action that the user has completed
  """
  type UserAction {
    """
    The relevant user that made the action
    """
    user: User!

    """
    The type of action the user performed
    """
    type: String!

    """
    The date when the user completed the type of action
    """
    completedAt: DateTime!
  }

  extend type Mutation {
    """
    Complete action by the logged in user
    """
    completeAction(type: String!): EmptyResponse @auth
  }

  extend type Query {
    """
    Get the actions for user
    """
    actions: [UserAction]! @auth
  }
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = traceResolvers({
  Mutation: {
    completeAction: async (
      _,
      { type }: CompleteActionParams,
      { con, userId },
    ): Promise<GQLEmptyResponse> => {
      await con
        .getRepository(UserAction)
        .createQueryBuilder()
        .insert()
        .values({ userId, type })
        .orIgnore()
        .execute();

      return;
    },
  },
  Query: {
    actions: (_, __, ctx, info): Promise<GQLUserAction[]> =>
      graphorm.query<GQLUserAction>(ctx, info, (builder) => {
        builder.queryBuilder = builder.queryBuilder.where({
          userId: ctx.userId,
        });

        return builder;
      }),
  },
});
