import { AuthContext } from '../Context';
import {
  ContentPreferenceStatus,
  ContentPreferenceType,
} from '../entity/contentPreference/types';
import { ContentPreferenceUser } from '../entity/contentPreference/ContentPreferenceUser';
import { NotificationPreferenceUser } from '../entity/notifications/NotificationPreferenceUser';
import { NotificationType } from '../notifications/common';
import { EntityManager, In } from 'typeorm';
import { ConflictError } from '../errors';
import { ContentPreferenceFeedKeyword } from '../entity/contentPreference/ContentPreferenceFeedKeyword';
import { FeedTag } from '../entity';

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
  [ContentPreferenceType.Keyword]: [],
};

export const contentPreferenceNotificationTypes = Object.values(
  entityToNotificationTypeMap,
).flat();

const cleanContentNotificationPreference = async ({
  ctx,
  entityManager,
  id,
  notificationTypes,
}: {
  ctx: AuthContext;
  entityManager?: EntityManager;
  id: string;
  notificationTypes: NotificationType[];
}) => {
  const notificationRepository = (entityManager ?? ctx.con).getRepository(
    NotificationPreferenceUser,
  );

  if (!notificationTypes.length) {
    return;
  }

  await notificationRepository.delete({
    userId: ctx.userId,
    referenceId: id,
    notificationType: In(notificationTypes),
  });
};

const followUser: FollowEntity = async ({ ctx, id, status }) => {
  if (ctx.userId === id) {
    throw new ConflictError('Cannot follow yourself');
  }

  await ctx.con.transaction(async (entityManager) => {
    const repository = entityManager.getRepository(ContentPreferenceUser);

    const contentPreference = repository.create({
      userId: ctx.userId,
      referenceId: id,
      referenceUserId: id,
      status,
    });

    await repository.save(contentPreference);

    if (status !== ContentPreferenceStatus.Subscribed) {
      cleanContentNotificationPreference({
        ctx,
        entityManager,
        id,
        notificationTypes: entityToNotificationTypeMap.user,
      });
    }
  });
};

const unfollowUser: UnFollowEntity = async ({ ctx, id }) => {
  await ctx.con.transaction(async (entityManager) => {
    const repository = entityManager.getRepository(ContentPreferenceUser);

    await repository.delete({
      userId: ctx.userId,
      referenceUserId: id,
      referenceId: id,
    });

    cleanContentNotificationPreference({
      ctx,
      entityManager,
      id,
      notificationTypes: entityToNotificationTypeMap.user,
    });
  });
};

const followKeyword: FollowEntity = async ({ ctx, id, status }) => {
  await ctx.con.transaction(async (entityManager) => {
    const repository = entityManager.getRepository(
      ContentPreferenceFeedKeyword,
    );

    const contentPreference = repository.create({
      userId: ctx.userId,
      referenceId: id,
      keywordId: id,
      feedId: ctx.userId,
      status,
    });

    await repository.save(contentPreference);

    if (status !== ContentPreferenceStatus.Subscribed) {
      cleanContentNotificationPreference({
        ctx,
        entityManager,
        id,
        notificationTypes: entityToNotificationTypeMap.keyword,
      });
    }

    // TODO follow phase 3 remove when backward compatibility is done
    await entityManager.getRepository(FeedTag).save({
      feedId: ctx.userId,
      tag: id,
    });
  });
};

const unfollowKeyword: UnFollowEntity = async ({ ctx, id }) => {
  await ctx.con.transaction(async (entityManager) => {
    const repository = entityManager.getRepository(
      ContentPreferenceFeedKeyword,
    );

    await repository.delete({
      userId: ctx.userId,
      keywordId: id,
      referenceId: id,
    });

    cleanContentNotificationPreference({
      ctx,
      entityManager,
      id,
      notificationTypes: entityToNotificationTypeMap.keyword,
    });

    // TODO follow phase 3 remove when backward compatibility is done
    await entityManager.getRepository(FeedTag).delete({
      feedId: ctx.userId,
      tag: id,
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
    case ContentPreferenceType.Keyword:
      return followKeyword({ ctx, id, status });
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
    case ContentPreferenceType.Keyword:
      return unfollowKeyword({ ctx, id });
    default:
      throw new Error('Entity not supported');
  }
};
