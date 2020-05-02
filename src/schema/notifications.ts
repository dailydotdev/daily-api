import { gql, IResolvers } from 'apollo-server-fastify';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import { Notification } from '../entity';

interface GQLNotification {
  timestamp: Date;
  html: string;
}

export const typeDefs = gql`
  """
  News and updates notification
  """
  type Notification {
    """
    The time of the notification
    """
    timestamp: DateTime!

    """
    The content of the notification in HTML format
    """
    html: String!
  }

  extend type Query {
    """
    Get up to 5 latest notifications
    """
    latestNotifications: [Notification!]!
  }
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = traceResolvers({
  Query: {
    latestNotifications: async (
      source,
      args,
      ctx,
    ): Promise<GQLNotification[]> =>
      ctx
        .getRepository(Notification)
        .find({ order: { timestamp: 'DESC' }, take: 5 }),
  },
});
