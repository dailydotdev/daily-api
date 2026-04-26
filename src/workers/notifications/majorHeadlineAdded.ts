import { TypedNotificationWorker } from '../worker';
import { PostHighlightedMessage } from '@dailydotdev/schema';
import { NotificationType } from '../../notifications/common';
import { PostHighlightSignificance } from '../../entity/PostHighlight';
import { PostType, User } from '../../entity';
import type { PostFlags } from '../../entity';
import { buildPostContext } from './utils';
import type { NotificationMajorHeadlineContext } from '../../notifications/types';

const NOTIFY_SIGNIFICANCE = new Set<PostHighlightSignificance>([
  PostHighlightSignificance.Breaking,
  PostHighlightSignificance.Major,
]);

const blockedPostTypes = new Set<PostType>([
  PostType.Welcome,
  PostType.Brief,
  PostType.Digest,
]);

export const majorHeadlineAdded: TypedNotificationWorker<'api.v1.post-highlighted'> =
  {
    subscription: 'api.major-headline-added-notification',
    parseMessage: (message) => PostHighlightedMessage.fromBinary(message.data),
    handler: async (data, con) => {
      const { postId, headline, channel, significance } = data;

      if (!NOTIFY_SIGNIFICANCE.has(significance as PostHighlightSignificance)) {
        return;
      }

      const baseCtx = await buildPostContext(con, postId);
      if (!baseCtx) {
        return;
      }

      const { post } = baseCtx;

      if (blockedPostTypes.has(post.type)) {
        return;
      }

      if ((post.flags as PostFlags)?.vordr) {
        return;
      }

      if (post.private || !post.visible || post.deleted) {
        return;
      }

      const users = await con
        .createQueryBuilder()
        .select('u.id', 'userId')
        .from(User, 'u')
        .where(
          `COALESCE(u."notificationFlags"->'major_headline_added'->>'inApp', 'subscribed') = 'subscribed'`,
        )
        .getRawMany<{ userId: string }>();

      if (!users.length) {
        return;
      }

      return [
        {
          type: NotificationType.MajorHeadlineAdded,
          ctx: {
            ...baseCtx,
            userIds: users.map(({ userId }) => userId),
            headline,
            channel,
            significance,
          } as NotificationMajorHeadlineContext,
        },
      ];
    },
  };
