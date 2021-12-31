import { ALERTS_DEFAULT, Alerts } from '../entity';

import { IResolvers } from 'graphql-tools';
import { traceResolvers } from './trace';
import { Context } from '../Context';

interface GQLAlerts {
  filter: boolean;
}

interface GQLUpdateAlertsInput extends Partial<GQLAlerts> {
  filter?: boolean;
}

export const typeDefs = /* GraphQL */ `
  """
  Alerts to display to the relevant user
  """
  enum MyFeed {
    default
    manual
  }
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
    Wether to show the my feed alert (default/manual/null)
    default: The user has existing filters so we created myFeed for them
    manual: The user applied filters himself
    null: The user clicked to not show the alert anymore
    """
    myFeed: MyFeed
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
    myFeed: MyFeed
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = traceResolvers({
  Mutation: {
    updateUserAlerts: async (
      _,
      { data }: { data: GQLUpdateAlertsInput },
      ctx,
    ): Promise<GQLAlerts> => {
      const repo = ctx.getRepository(Alerts);
      const alerts = await repo.findOne(ctx.userId);

      if (!alerts) {
        return repo.save({ userId: ctx.userId, ...data });
      }

      return repo.save({ ...alerts, ...data });
    },
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
