import { TypedNotificationWorker } from '../worker';
import { NotificationType } from '../../notifications/common';
import { PostHighlightSignificance } from '../../entity/PostHighlight';
import { PostType, User } from '../../entity';
import type { PostFlags } from '../../entity';
import { buildPostContext } from './utils';
import type { NotificationMajorHeadlineContext } from '../../notifications/types';
import { processStream } from '../../common/streaming';

const blockedPostTypes = new Set<PostType>([
  PostType.Welcome,
  PostType.Brief,
  PostType.Digest,
]);

const streamConcurrency = 10;

export const majorHeadlineAdded: TypedNotificationWorker<'api.v1.highlight-created'> =
  {
    subscription: 'api.major-headline-added-notification-v2',
    handler: async (data, con) => {
      const { postId, headline, significance } = data;

      if (significance !== PostHighlightSignificance.Breaking) {
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

      const userIds: string[] = [];
      const stream = await con
        .createQueryBuilder()
        .select('u.id', 'id')
        .from(User, 'u')
        .where(
          `COALESCE(u."notificationFlags"->'major_headline_added'->>'inApp', 'subscribed') = 'subscribed'`,
        )
        .stream();

      await processStream<{ id: string }>(
        stream,
        async (row) => {
          userIds.push(row.id);
        },
        streamConcurrency,
      );

      if (!userIds.length) {
        return;
      }

      return [
        {
          type: NotificationType.MajorHeadlineAdded,
          ctx: {
            ...baseCtx,
            userIds,
            headline,
            significance,
          } as NotificationMajorHeadlineContext,
        },
      ];
    },
  };
