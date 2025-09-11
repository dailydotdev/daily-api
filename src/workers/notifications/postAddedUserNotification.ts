import { User } from '../../entity/user/User';
import { ContentPreference } from '../../entity/contentPreference/ContentPreference';
import {
  ContentPreferenceStatus,
  ContentPreferenceType,
} from '../../entity/contentPreference/types';
import {
  NotificationPreferenceStatus,
  NotificationType,
} from '../../notifications/common';
import {
  NotificationPostContext,
  NotificationUserContext,
} from '../../notifications/types';
import { counters } from '../../telemetry/metrics';
import { processStream } from '../../common/streaming';
import { buildPostContext } from './utils';
import { Post, PostType } from '../../entity/posts/Post';
import { NotificationPreferenceUser } from '../../entity';
import { Brackets } from 'typeorm';
import { TypedNotificationWorker } from '../worker';

const sendQueueConcurrency = 10;

const skippedTypes = Object.freeze([PostType.Brief]);

export const postAddedUserNotification: TypedNotificationWorker<'api.v1.post-visible'> =
  {
    subscription: 'api.post-added-user-notification',
    handler: async (data, con) => {
      if (data.post.private) {
        return;
      }

      if (skippedTypes.includes(data.post.type)) {
        return;
      }

      const baseCtx = await buildPostContext(con, data.post.id);

      if (!baseCtx) {
        return;
      }

      const { post } = baseCtx;

      const postEntity = post as Post;

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
        .createQueryBuilder('cp')
        .leftJoin(
          NotificationPreferenceUser,
          'np',
          'np.userId = cp."userId" AND np."notificationType" = :notificationType',
          {
            notificationType: NotificationType.UserPostAdded,
          },
        )
        .select('cp."referenceId"')
        .addSelect('cp."userId"')
        .where('cp."referenceId" IN(:...referencedUserIds)', {
          referencedUserIds: users.map((user) => user.id),
        })
        .andWhere('cp.type = :referencedType', {
          referencedType: ContentPreferenceType.User,
        })
        .andWhere('cp.status = :referenceStatus', {
          referenceStatus: ContentPreferenceStatus.Subscribed,
        })
        .andWhere(
          new Brackets((qb) => {
            qb.where('np.status != :notificationStatus', {
              notificationStatus: NotificationPreferenceStatus.Muted,
            }).orWhere('np.status IS NULL');
          }),
        );
      const contentPreferenceStream = await contentPreferenceQuery.stream();

      const notificationResult = users.reduce(
        (acc, item) => {
          acc.set(item.id, {
            type: NotificationType.UserPostAdded,
            ctx: {
              ...baseCtx,
              userIds: [],
              user: item,
              initiatorId: post.authorId,
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
  };
