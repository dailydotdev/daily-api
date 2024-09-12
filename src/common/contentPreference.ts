import { AuthContext } from '../Context';
import {
  ContentPreferenceStatus,
  ContentPreferenceType,
} from '../entity/contentPreference/types';
import { ContentPreferenceUser } from '../entity/contentPreference/ContentPreferenceUser';
import { NotificationPreferenceUser } from '../entity/notifications/NotificationPreferenceUser';
import {
  NotificationPreferenceStatus,
  NotificationType,
} from '../notifications/common';

type FollowEntity = ({
  ctx,
  id,
  status,
}: {
  ctx: AuthContext;
  id: string;
  status: ContentPreferenceStatus.Follow | ContentPreferenceStatus.Subscribed;
}) => Promise<void>;

type UnFollowEntity = ({
  ctx,
  id,
}: {
  ctx: AuthContext;
  id: string;
}) => Promise<void>;

const entityToNotificationTypeMap: Record<
  ContentPreferenceType,
  NotificationType[]
> = {
  [ContentPreferenceType.User]: [NotificationType.UserPostAdded],
};

const followUser: FollowEntity = async ({ ctx, id, status }) => {
  await ctx.con.transaction(async (entityManager) => {
    const repository = entityManager.getRepository(ContentPreferenceUser);

    const contentPreference = repository.create({
      userId: ctx.userId,
      referenceId: id,
      referenceUserId: id,
      status,
    });

    await repository.save(contentPreference);

    if (status === ContentPreferenceStatus.Subscribed) {
      const notificationRepository = entityManager.getRepository(
        NotificationPreferenceUser,
      );

      const notificationPreferences = entityToNotificationTypeMap.user.map(
        (notificationType) => {
          return notificationRepository.create({
            userId: ctx.userId,
            referenceId: id,
            notificationType,
            status: NotificationPreferenceStatus.Subscribed,
          });
        },
      );

      await notificationRepository.save(notificationPreferences);
    }
  });
};

const unfollowUser: UnFollowEntity = async ({ ctx, id }) => {
  await ctx.con.transaction(async (entityManager) => {
    const repository = entityManager.getRepository(ContentPreferenceUser);

    await repository.delete({
      userId: ctx.userId,
      referenceId: id,
    });

    const notificationRepository = entityManager.getRepository(
      NotificationPreferenceUser,
    );

    await notificationRepository.delete({
      userId: ctx.userId,
      referenceUserId: id,
      referenceId: id,
    });
  });
};

export const followEntity = ({
  ctx,
  id,
  entity,
  status,
}: {
  ctx: AuthContext;
  id: string;
  entity: ContentPreferenceType;
  status: ContentPreferenceStatus.Follow | ContentPreferenceStatus.Subscribed;
}): Promise<void> => {
  switch (entity) {
    case ContentPreferenceType.User:
      return followUser({ ctx, id, status });
    default:
      throw new Error('Entity not supported');
  }
};

export const unfollowEntity = ({
  ctx,
  id,
  entity,
}: {
  ctx: AuthContext;
  id: string;
  entity: ContentPreferenceType;
}): Promise<void> => {
  switch (entity) {
    case ContentPreferenceType.User:
      return unfollowUser({ ctx, id });
    default:
      throw new Error('Entity not supported');
  }
};
