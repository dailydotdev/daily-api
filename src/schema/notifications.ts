import { gql, IResolvers } from 'apollo-server-fastify';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import { Banner, Notification } from '../entity';

interface GQLNotification {
  timestamp: Date;
  html: string;
}

interface GQLBanner {
  timestamp: Date;
  title: string;
  subtitle: string;
  cta: string;
  url: string;
  theme: string;
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

  """
  Information for displaying promotions and announcements
  """
  type Banner {
    """
    Since when to show this banner
    """
    timestamp: DateTime!

    """
    Title to show
    """
    title: String!

    """
    Subtitle to show
    """
    subtitle: String!

    """
    Call-to-action text for the button
    """
    cta: String!

    """
    Link to navigate upon button click
    """
    url: String!

    """
    Banner theme
    """
    theme: String!
  }

  extend type Query {
    """
    Get up to 5 latest notifications
    """
    latestNotifications: [Notification!]! @cacheControl(maxAge: 600)
    """
    Get a banner to show, if any
    """
    banner(
      """
      The last time the user seen a banner
      """
      lastSeen: DateTime
    ): Banner @cacheControl(maxAge: 600)
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
    banner: async (source, args, ctx): Promise<GQLBanner | null> =>
      ctx
        .getRepository(Banner)
        .createQueryBuilder()
        .orderBy('timestamp', 'DESC')
        .getOne(),
  },
});
