import { gql, IResolvers } from 'apollo-server-fastify';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import { Alerts } from '../entity/Alerts';

interface GQLAlerts {
  userId: string;
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
    User ID
    """
    userId: ID!

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
    userAlerts: Alerts! @auth
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

      return repo.save({ ...data, ...alerts });
    },
  },
  Query: {
    userAlerts: async (_, __, ctx): Promise<GQLAlerts> => {
      const repo = ctx.getRepository(Alerts);
      const alerts = await repo.findOne(ctx.userId);

      if (!alerts) {
        await repo.insert({ userId: ctx.userId });
        return repo.findOne(ctx.userId);
      }
      return alerts;
    },
  },
});
