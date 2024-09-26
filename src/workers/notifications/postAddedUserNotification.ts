import { User } from '../../entity/user/User';
import { ContentPreference } from '../../entity/contentPreference/ContentPreference';
import {
  ContentPreferenceStatus,
  ContentPreferenceType,
} from '../../entity/contentPreference/types';
import { generateTypedNotificationWorker } from './worker';
import { NotificationType } from '../../notifications/common';
import {
  NotificationPostContext,
  NotificationUserContext,
} from '../../notifications/types';
import { counters } from '../../telemetry/metrics';
import { processStream } from '../../common/streaming';
import { buildPostContext } from './utils';
import { Post } from '../../entity/posts/Post';

const sendQueueConcurrency = 10;

export const postAddedUserNotification =
  generateTypedNotificationWorker<'api.v1.post-visible'>({
    subscription: 'api.post-added-user-notification',
    handler: async (data, con) => {
      if (data.post.private) {
        return;
      }

      const baseCtx = await buildPostContext(con, data.post.id);
      const { post } = baseCtx;

      const postEntity = post as Post;

      if (!baseCtx) {
        return;
      }

      const userPromises: Promise<User>[] = [];

      if (post.authorId) {
        userPromises.push(postEntity.author);
      }

      if (post.scoutId && post.authorId !== post.scoutId) {
        userPromises.push(postEntity.scout);
      }

      if (userPromises.length === 0) {
        return;
      }

      const users = await Promise.all(userPromises);

      const contentPreferenceQuery = con
        .getRepository(ContentPreference)
        .createQueryBuilder()
        .select('"referenceId"')
        .addSelect('"userId"')
        .where('"referenceId" IN(:...referencedUserIds)', {
          referencedUserIds: users.map((user) => user.id),
        })
        .andWhere('type = :referencedType', {
          referencedType: ContentPreferenceType.User,
        })
        .andWhere('status = :referenceStatus', {
          referenceStatus: ContentPreferenceStatus.Subscribed,
        });
      const contentPreferenceStream = await contentPreferenceQuery.stream();

      const notificationResult = users.reduce(
        (acc, item) => {
          acc.set(item.id, {
            type: NotificationType.UserPostAdded,
            ctx: {
              ...baseCtx,
              userIds: [],
              user: item,
            },
          });

          counters?.background?.notificationUserPostAdded?.add(1, {
            user: item.id,
          });

          return acc;
        },
        new Map<
          string,
          {
            type: NotificationType;
            ctx: NotificationUserContext & NotificationPostContext;
          }
        >(),
      );

      await processStream<ContentPreference>(
        contentPreferenceStream,
        async (contentPreference) => {
          notificationResult
            .get(contentPreference.referenceId)
            ?.ctx.userIds.push(contentPreference.userId);
        },
        sendQueueConcurrency,
      );

      return Array.from(notificationResult.values());
    },
  });
