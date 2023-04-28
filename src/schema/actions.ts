import { Action, ActionType } from '../entity';

import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import { EmptyResponse } from '@google-cloud/pubsub';

type GQLAction = Pick<Action, 'userId' | 'type' | 'completedAt'>;

interface CompleteActionParams {
  type: ActionType;
}

export const typeDefs = /* GraphQL */ `
  """
  Action that the user has completed
  """
  type Action {
    """
    The relevant user that made the action
    """
    userId: ID!

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
    actions: [Action]! @auth
  }
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = traceResolvers({
  Mutation: {
    completeAction: async (
      _,
      { type }: CompleteActionParams,
      { con, userId },
    ): Promise<EmptyResponse> => {
      await con
        .getRepository(Action)
        .createQueryBuilder()
        .insert()
        .values({ userId, type })
        .orIgnore()
        .execute();

      return;
    },
  },
  Query: {
    actions: (_, __, { con, userId }): Promise<GQLAction[]> =>
      con.getRepository(Action).findBy({ userId }),
  },
});
