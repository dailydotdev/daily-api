import { ALERTS_DEFAULT } from './../entity/Alerts';
import { gql, IResolvers } from 'apollo-server-fastify';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import { Alerts } from '../entity/Alerts';

interface GQLAlerts {
  filter: boolean;
}

interface GQLUpdateAlertsInput extends Partial<GQLAlerts> {
  filter?: boolean;
}

export const typeDefs = gql`
  """
  Alerts to display to the relevant user
  """
  type Alerts {
    """
    Status to display for filter red dot
    """
    filter: Boolean!
  }

  input UpdateAlertsInput {
    """
    Status to display for filter red dot
    """
    filter: Boolean
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
      const repo = ctx.getRepository(Alerts);
      const alerts = await repo.findOne(ctx.userId);

      if (!alerts) {
        return Promise.resolve(ALERTS_DEFAULT);
      }

      return alerts;
    },
  },
});
