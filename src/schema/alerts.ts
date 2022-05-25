import { Connection } from 'typeorm';
import { ALERTS_DEFAULT, Alerts } from '../entity';

import { IResolvers } from 'graphql-tools';
import { traceResolvers } from './trace';
import { Context } from '../Context';

interface GQLAlerts {
  filter: boolean;
}

interface GQLUpdateAlertsInput extends Partial<GQLAlerts> {
  filter?: boolean;
  myFeed?: string;
}

export const typeDefs = /* GraphQL */ `
  """
  Alerts to display to the relevant user
  """
  type Alerts {
    """
    Status to display for filter red dot
    """
    filter: Boolean!

    """
    Date last seen of the rank achievement popup
    """
    rankLastSeen: DateTime

    """
    Wether to show the my feed alert (migrated/created/null)
    migrated: The user has existing filters so we created myFeed for them
    created: The user applied filters himself
    null: The user clicked to not show the alert anymore
    """
    myFeed: String

    """
    Wether to show the companion helper
    Default = true, meaning yes show it
    Once the user has seen it once, we set this value to false
    """
    companionHelper: Boolean!

    """
    For existing users, we will display the companion popup onload
    """
    addCompanion: Boolean!
  }

  input UpdateAlertsInput {
    """
    Status to display for filter red dot
    """
    filter: Boolean

    """
    Date last seen of the rank achievement popup
    """
    rankLastSeen: DateTime

    """
    Status for the My Feed alert
    """
    myFeed: String

    """
    Status to display for companion helper
    """
    companionHelper: Boolean
  }

  extend type Mutation {
    """
    Update the alerts for user
    """
    updateUserAlerts(data: UpdateAlertsInput!): Alerts! @auth
  }

  extend type Query {
    """
    Get the alerts for user
    """
    userAlerts: Alerts!
  }
`;

export const updateAlerts = async (
  con: Connection,
  userId: string,
  data: GQLUpdateAlertsInput,
): Promise<GQLAlerts> => {
  const repo = con.getRepository(Alerts);
  const alerts = await repo.findOne(userId);

  if (!alerts) {
    return repo.save({ userId, ...data });
  }

  return repo.save({ ...alerts, ...data });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = traceResolvers({
  Mutation: {
    updateUserAlerts: async (
      _,
      { data }: { data: GQLUpdateAlertsInput },
      ctx,
    ): Promise<GQLAlerts> => updateAlerts(ctx.con, ctx.userId, data),
  },
  Query: {
    userAlerts: async (_, __, ctx): Promise<GQLAlerts> => {
      if (ctx.userId) {
        const repo = ctx.getRepository(Alerts);
        const alerts = await repo.findOne(ctx.userId);

        if (alerts) {
          return alerts;
        }
      }
      return ALERTS_DEFAULT;
    },
  },
});
