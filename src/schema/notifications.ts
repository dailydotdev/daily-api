import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { Context, SubscriptionContext } from '../Context';
import {
  Banner,
  getUnreadNotificationsCount,
  Notification,
  NotificationPreference,
} from '../entity';
import { ConnectionArguments } from 'graphql-relay';
import { IsNull } from 'typeorm';
import { Connection as ConnectionRelay } from 'graphql-relay/connection/connection';
import graphorm from '../graphorm';
import { createDatePageGenerator } from '../common/datePageGenerator';
import { GQLEmptyResponse } from './common';
import { notifyNotificationsRead } from '../common';
import { redisPubSub } from '../redis';
import { NotificationPreferenceType } from '../notifications/common';

interface GQLBanner {
  timestamp: Date;
  title: string;
  subtitle: string;
  cta: string;
  url: string;
  theme: string;
}

type GQLNotificationPreference = Pick<
  NotificationPreference,
  'uniqueKey' | 'userId' | 'notificationType' | 'status' | 'type'
>;

interface NotificationPreferenceArgs {
  type: NotificationPreferenceType;
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
    """
    ID of the referenced object
    """
    referenceId: String!
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
    Icon type of the notification
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

  type NotificationEdge {
    node: Notification!

    """
    Used in \`before\` and \`after\` args
    """
    cursor: String!
  }

  type NotificationConnection {
    pageInfo: PageInfo!
    edges: [NotificationEdge!]!
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

  """
  User's preference towards certain notification types to specific entities
  """
  type NotificationPreference {
    """
    Reference to id of the related entity
    """
    uniqueKey: ID!

    """
    User id of the related user
    """
    userId: ID!

    """
    Type of the notification
    """
    notificationType: String!

    """
    Type of the notification preference which can be "post", "source", "comment"
    """
    type: String!

    """
    Status whether the user has "subscribed" or "muted" the notification
    """
    status: String!
  }

  extend type Query {
    """
    Get the active notification count for a user
    """
    unreadNotificationsCount: Int @auth
    """
    Get a banner to show, if any
    """
    banner(
      """
      The last time the user seen a banner
      """
      lastSeen: DateTime
    ): Banner @cacheControl(maxAge: 60)

    notifications(
      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int
    ): NotificationConnection! @auth

    notificationPreferences(type: String): [NotificationPreference]! @auth
  }

  extend type Mutation {
    readNotifications: EmptyResponse @auth
  }

  type Subscription {
    """
    Get notified when there's a new notification
    """
    newNotification: Notification @auth
  }
`;

const notificationsPageGenerator = createDatePageGenerator<
  Notification,
  'createdAt'
>({
  key: 'createdAt',
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = traceResolvers({
  Query: {
    unreadNotificationsCount: async (
      source,
      args: ConnectionArguments,
      ctx,
    ): Promise<number> =>
      await getUnreadNotificationsCount(ctx.con, ctx.userId),
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
    notifications: async (
      source,
      args: ConnectionArguments,
      ctx,
      info,
    ): Promise<ConnectionRelay<Notification>> => {
      const page = notificationsPageGenerator.connArgsToPage(args);
      return graphorm.queryPaginated(
        ctx,
        info,
        (nodeSize) =>
          notificationsPageGenerator.hasPreviousPage(page, nodeSize),
        (nodeSize) => notificationsPageGenerator.hasNextPage(page, nodeSize),
        (node, index) =>
          notificationsPageGenerator.nodeToCursor(page, args, node, index),
        (builder) => {
          builder.queryBuilder
            .andWhere(`${builder.alias}."userId" = :user`, { user: ctx.userId })
            .andWhere(`${builder.alias}."public" = true`)
            .addOrderBy(`${builder.alias}."createdAt"`, 'DESC');

          builder.queryBuilder.limit(page.limit);
          if (page.timestamp) {
            builder.queryBuilder = builder.queryBuilder.andWhere(
              `${builder.alias}."createdAt" < :timestamp`,
              { timestamp: page.timestamp },
            );
          }
          return builder;
        },
      );
    },
    notificationPreferences: (
      _,
      { type }: NotificationPreferenceArgs,
      { con, userId },
    ): Promise<GQLNotificationPreference[]> =>
      con.getRepository(NotificationPreference).findBy({ userId, type }),
  },
  Mutation: {
    readNotifications: async (source, _, ctx): Promise<GQLEmptyResponse> => {
      await ctx.getRepository(Notification).update(
        {
          userId: ctx.userId,
          readAt: IsNull(),
        },
        { readAt: new Date() },
      );
      await notifyNotificationsRead(ctx.log, {
        unreadNotificationsCount: 0,
      });
      return { _: true };
    },
  },
  Subscription: {
    newNotification: {
      subscribe: async (
        source,
        args,
        ctx: SubscriptionContext,
      ): Promise<AsyncIterator<{ newNotification: Notification }>> => {
        const it = {
          [Symbol.asyncIterator]: () =>
            redisPubSub.asyncIterator<Notification>(
              `events.notifications.${ctx.userId}.new`,
            ),
        };
        return (async function* () {
          for await (const value of it) {
            yield { newNotification: value };
          }
        })();
      },
    },
  },
});
