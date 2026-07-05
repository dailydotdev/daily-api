import { getPostScheduledAt } from '../../common/postScheduling';
import type { PostFlags } from '../../entity/posts/Post';
import { NotificationType } from '../../notifications/common';
import type { NotificationPostContext } from '../../notifications/types';
import { TypedNotificationWorker } from '../worker';
import { buildPostContext } from './utils';

const getScheduledAtFromFlags = (
  flags: PostFlags | string | null | undefined,
): Date | null => {
  if (!flags) {
    return null;
  }

  if (typeof flags !== 'string') {
    return getPostScheduledAt({ flags });
  }

  try {
    return getPostScheduledAt({ flags: JSON.parse(flags) as PostFlags });
  } catch {
    return null;
  }
};

export const scheduledPostPublishedNotification: TypedNotificationWorker<'api.v1.post-visible'> =
  {
    subscription: 'api.scheduled-post-published-notification',
    handler: async (data, con) => {
      if (!getScheduledAtFromFlags(data.previousPost?.flags)) {
        return;
      }

      const baseCtx = await buildPostContext(con, data.post.id);

      if (!baseCtx) {
        return;
      }

      const authorId = data.post.authorId || baseCtx.post.authorId;

      if (!authorId) {
        return;
      }

      return [
        {
          type: NotificationType.ScheduledPostPublished,
          ctx: {
            ...baseCtx,
            userIds: [authorId],
          } as NotificationPostContext,
        },
      ];
    },
  };
