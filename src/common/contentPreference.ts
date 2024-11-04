import { AuthContext } from '../Context';
import {
  ContentPreferenceStatus,
  ContentPreferenceType,
} from '../entity/contentPreference/types';
import { ContentPreferenceUser } from '../entity/contentPreference/ContentPreferenceUser';
import { NotificationType } from '../notifications/common';
import { EntityManager, EntityTarget, In } from 'typeorm';
import { ConflictError } from '../errors';
import { ContentPreferenceFeedKeyword } from '../entity/contentPreference/ContentPreferenceFeedKeyword';
import { ContentPreferenceSource } from '../entity/contentPreference/ContentPreferenceSource';
import {
  FeedSource,
  FeedTag,
  NotificationPreference,
  NotificationPreferenceSource,
  NotificationPreferenceUser,
} from '../entity';
import { ghostUser } from './utils';

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
  [ContentPreferenceType.Source]: [
    NotificationType.SourcePostAdded,
    NotificationType.SquadPostAdded,
  ],
};

// TODO fix api.new-notification-mail condition to handle all types when follow phase 3 is implemented
export const contentPreferenceNotificationTypes = Object.values(
  entityToNotificationTypeMap.user,
).flat();

const cleanContentNotificationPreference = async ({
  ctx,
  entityManager,
  id,
  notificationTypes,
  notficationEntity,
}: {
  ctx: AuthContext;
  entityManager?: EntityManager;
  id: string;
  notificationTypes: NotificationType[];
  notficationEntity: EntityTarget<NotificationPreference>;
}) => {
  const notificationRepository = (entityManager ?? ctx.con).getRepository(
    notficationEntity,
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

  if (ghostUser.id === id) {
    throw new ConflictError('Cannot follow this user');
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
        notficationEntity: NotificationPreferenceUser,
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
      notficationEntity: NotificationPreferenceUser,
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

    // TODO follow phase 3 remove when backward compatibility is done
    await entityManager.getRepository(FeedTag).delete({
      feedId: ctx.userId,
      tag: id,
    });
  });
};

const followSource: FollowEntity = async ({ ctx, id, status }) => {
  await ctx.con.transaction(async (entityManager) => {
    const repository = entityManager.getRepository(ContentPreferenceSource);

    const contentPreference = repository.create({
      userId: ctx.userId,
      referenceId: id,
      sourceId: id,
      feedId: ctx.userId,
      status,
    });

    await repository.save(contentPreference);

    if (status !== ContentPreferenceStatus.Subscribed) {
      cleanContentNotificationPreference({
        ctx,
        entityManager,
        id,
        notificationTypes: entityToNotificationTypeMap.source,
        notficationEntity: NotificationPreferenceSource,
      });
    }

    // TODO follow phase 3 remove when backward compatibility is done
    await entityManager.getRepository(FeedSource).save({
      feedId: ctx.userId,
      sourceId: id,
      blocked: false,
    });
  });
};

const unfollowSource: UnFollowEntity = async ({ ctx, id }) => {
  await ctx.con.transaction(async (entityManager) => {
    const repository = entityManager.getRepository(ContentPreferenceSource);

    await repository.delete({
      userId: ctx.userId,
      sourceId: id,
      referenceId: id,
    });

    cleanContentNotificationPreference({
      ctx,
      entityManager,
      id,
      notificationTypes: entityToNotificationTypeMap.source,
      notficationEntity: NotificationPreferenceSource,
    });

    await entityManager.getRepository(FeedSource).delete({
      feedId: ctx.userId,
      sourceId: id,
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
    case ContentPreferenceType.Source:
      return followSource({ ctx, id, status });
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
    case ContentPreferenceType.Source:
      return unfollowSource({ ctx, id });
    default:
      throw new Error('Entity not supported');
  }
};
