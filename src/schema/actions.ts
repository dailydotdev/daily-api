import { UserAction, UserActionType } from '../entity';

import { IResolvers } from '@graphql-tools/utils';
import { GQLEmptyResponse } from './common';
import graphorm from '../graphorm';
import { DataSource, type EntityManager } from 'typeorm';
import { AuthContext, BaseContext } from '../Context';
import { QuestEventType } from '../entity/Quest';
import { logger } from '../logger';

type GQLUserAction = Pick<UserAction, 'userId' | 'type' | 'completedAt'>;

interface CompleteActionParams {
  type: UserActionType;
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

export const insertOrIgnoreAction = (
  con: DataSource | EntityManager,
  userId: string,
  type: UserActionType,
) =>
  con
    .getRepository(UserAction)
    .createQueryBuilder()
    .insert()
    .values({ userId, type })
    .orIgnore()
    .execute();

const userActionTypeToQuestEventType: Partial<
  Record<UserActionType, QuestEventType>
> = {
  [UserActionType.EnableNotification]: QuestEventType.NotificationsEnable,
};

const maybeTrackQuestProgress = async ({
  con,
  userId,
  type,
}: {
  con: DataSource;
  userId: string;
  type: UserActionType;
}): Promise<void> => {
  const questEventType = userActionTypeToQuestEventType[type];
  if (!questEventType) {
    return;
  }

  try {
    // Avoid loading quest progress side effects during TypeORM CLI entity discovery.
    const { checkQuestProgress } = await import('../common/quest/progress');

    await checkQuestProgress({
      con: con.manager,
      logger,
      userId,
      eventType: questEventType,
    });
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err), userId },
      `Failed to track ${questEventType} quest progress`,
    );
  }
};

export const resolvers: IResolvers<unknown, BaseContext> = {
  Mutation: {
    completeAction: async (
      _,
      { type }: CompleteActionParams,
      { con, userId }: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      await insertOrIgnoreAction(con, userId, type);
      await maybeTrackQuestProgress({ con, userId, type });

      return {
        _: true,
      };
    },
  },
  Query: {
    actions: (_, __, ctx: AuthContext, info): Promise<GQLUserAction[]> =>
      graphorm.query<GQLUserAction>(ctx, info, (builder) => {
        builder.queryBuilder = builder.queryBuilder.where({
          userId: ctx.userId,
        });

        return builder;
      }),
  },
};
