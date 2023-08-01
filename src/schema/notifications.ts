import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { Context, SubscriptionContext } from '../Context';
import {
  Banner,
  getUnreadNotificationsCount,
  Notification,
  NotificationPreference,
  Comment,
} from '../entity';
import { ConnectionArguments } from 'graphql-relay';
import { In, IsNull } from 'typeorm';
import { Connection as ConnectionRelay } from 'graphql-relay/connection/connection';
import graphorm from '../graphorm';
import { createDatePageGenerator } from '../common/datePageGenerator';
import { GQLEmptyResponse } from './common';
import { notifyNotificationsRead } from '../common';
import { redisPubSub } from '../redis';
import {
  NotificationPreferenceStatus,
  NotificationType,
  saveNotificationPreference,
  postNewCommentNotificationTypes,
  notificationPreferenceMap,
} from '../notifications/common';
import { ValidationError } from 'apollo-server-errors';

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
  'referenceId' | 'userId' | 'notificationType' | 'status' | 'type'
>;

interface NotificationPreferenceArgs {
  referenceId: string;
  notificationType: NotificationType;
}

interface NotificationPreferenceMutationArgs {
  type: NotificationType;
  referenceId: string;
}

interface NotificationPreferenceInput {
  data: NotificationPreferenceArgs[];
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
    Referenced entity's id of the notification
    """
    referenceId: String!
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
    referenceId: ID!

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

  input NotificationPreferenceInput {
    """
    Reference to id of the related entity
    """
    referenceId: ID!

    """
    Notification type for which kind of notification you want to mute
    """
    notificationType: String!
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

    notificationPreferences(
      data: [NotificationPreferenceInput]!
    ): [NotificationPreference]! @auth
  }

  extend type Mutation {
    readNotifications: EmptyResponse @auth

    """
    Set the status of the user's notification preference to "muted"
    """
    muteNotificationPreference(
      """
      The ID of the relevant entity to mute
      """
      referenceId: ID!

      """
      Notification type for which kind of notification you want to mute
      """
      type: String!
    ): EmptyResponse @auth

    """
    Remove notification preference if it exists
    """
    clearNotificationPreference(
      """
      The ID of the relevant entity to mute
      """
      referenceId: ID!

      """
      Notification type for which kind of notification you want to mute
      """
      type: String!
    ): EmptyResponse @auth
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
    notificationPreferences: async (
      _,
      { data }: NotificationPreferenceInput,
      ctx,
      info,
    ): Promise<GQLNotificationPreference[]> => {
      if (!data.length) {
        throw new ValidationError('parameters must not be empty');
      }

      const params = data.reduce((args, value) => {
        const type = notificationPreferenceMap[value.notificationType];
        return [...args, { ...value, type, userId: ctx.userId }];
      }, []);

      const newComments = data.filter(({ notificationType }) =>
        postNewCommentNotificationTypes.includes(notificationType),
      );

      if (newComments.length) {
        const ids = newComments.map(({ referenceId }) => referenceId);
        const comments = await ctx
          .getRepository(Comment)
          .find({ select: ['id', 'postId'], where: { id: In(ids) } });
        comments.forEach(({ id, postId }) => {
          const param = params.find(({ referenceId }) => referenceId === id);
          param.referenceId = postId;
        });
      }

      return graphorm.query(ctx, info, (builder) => {
        builder.queryBuilder = builder.queryBuilder.where(params);

        return builder;
      });
    },
  },
  Mutation: {
    readNotifications: async (_, __, ctx): Promise<GQLEmptyResponse> => {
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
    muteNotificationPreference: async (
      _,
      { type, referenceId }: NotificationPreferenceMutationArgs,
      { con, userId },
    ): Promise<GQLEmptyResponse> => {
      if (!Object.values(NotificationType).includes(type)) {
        throw new ValidationError('Invalid notification type');
      }

      await saveNotificationPreference(
        con,
        userId,
        referenceId,
        type,
        NotificationPreferenceStatus.Muted,
      );

      return { _: true };
    },
    clearNotificationPreference: async (
      _,
      { type, referenceId }: NotificationPreferenceMutationArgs,
      { con, userId },
    ): Promise<GQLEmptyResponse> => {
      if (postNewCommentNotificationTypes.includes(type)) {
        const comment = await con.getRepository(Comment).findOne({
          where: { id: referenceId },
          select: ['postId'],
        });

        if (!comment) {
          throw new ValidationError('Comment not found');
        }

        referenceId = comment.postId;
      }

      await con
        .getRepository(NotificationPreference)
        .delete({ userId, notificationType: type, referenceId });

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
