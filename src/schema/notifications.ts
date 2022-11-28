import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import { Banner } from '../entity';

interface GQLBanner {
  timestamp: Date;
  title: string;
  subtitle: string;
  cta: string;
  url: string;
  theme: string;
}

export const typeDefs = /* GraphQL */ `
  type NotificationAvatar {
    """
    Avatar type e.g user, source. Appearance might change based on the type
    """
    type: String!
    """
    URL of the image
    """
    image: String!
    """
    Name of the referred object e.g full name or source name
    """
    name: String!
    """
    URL of profile or source
    """
    targetUrl: String!
  }

  type NotificationAttachment {
    """
    Attachment type e.g post, badge. Appearance might change based on the type
    """
    type: String!
    """
    URL of the image
    """
    image: String!
    """
    Rich text (html) of the title
    """
    title: String!
  }

  type Notification {
    """
    Notification unique ID
    """
    id: ID!
    """
    Notification type
    """
    type: String!
    """
    URL of the icon of the notification
    """
    icon: String!
    """
    When the notification was created
    """
    createdAt: DateTime!
    """
    When the notification was read, if at all
    """
    readAt: DateTime
    """
    Rich text (html) of the title
    """
    title: String!
    """
    Rich text (html) of the description
    """
    description: String
    """
    URL to point client on click
    """
    targetUrl: String!
    """
    Avatars of the notification
    """
    avatars: [NotificationAvatar!]
    """
    Attachments of the notification
    """
    attachments: [NotificationAttachment!]
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
    Get a banner to show, if any
    """
    banner(
      """
      The last time the user seen a banner
      """
      lastSeen: DateTime
    ): Banner @cacheControl(maxAge: 60)
  }
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = traceResolvers({
  Query: {
    banner: async (
      source,
      { lastSeen }: { lastSeen: Date },
      ctx,
    ): Promise<GQLBanner | null> =>
      ctx
        .getRepository(Banner)
        .createQueryBuilder()
        .where('timestamp > :last', { last: lastSeen })
        .orderBy('timestamp', 'DESC')
        .getOne(),
  },
});
