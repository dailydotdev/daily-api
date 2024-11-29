import { AuthContext } from '../Context';
import {
  ContentPreferenceStatus,
  ContentPreferenceType,
} from '../entity/contentPreference/types';
import { ContentPreferenceUser } from '../entity/contentPreference/ContentPreferenceUser';
import {
  NotificationPreferenceStatus,
  NotificationType,
} from '../notifications/common';
import { DataSource, EntityManager, EntityTarget, In, Not } from 'typeorm';
import { ConflictError } from '../errors';
import { ContentPreferenceSource } from '../entity/contentPreference/ContentPreferenceSource';
import {
  FeedSource,
  FeedTag,
  NotificationPreference,
  NotificationPreferenceSource,
  NotificationPreferenceUser,
} from '../entity';
import { ghostUser, uniqueifyArray } from './utils';
import { randomUUID } from 'crypto';
import { SourceMemberRoles } from '../roles';
import { ContentPreferenceKeyword } from '../entity/contentPreference/ContentPreferenceKeyword';
import { logger } from '../logger';
import { ContentPreferenceWord } from '../entity/contentPreference/ContentPreferenceWord';

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

type BlockEntity = ({
  ctx,
  id,
}: {
  ctx: AuthContext;
  id: string;
}) => Promise<void>;

export const entityToNotificationTypeMap: Record<
  ContentPreferenceType,
  NotificationType[]
> = {
  [ContentPreferenceType.User]: [NotificationType.UserPostAdded],
  [ContentPreferenceType.Keyword]: [],
  [ContentPreferenceType.Source]: [
    NotificationType.SourcePostAdded,
    NotificationType.SquadPostAdded,
    NotificationType.SquadMemberJoined,
  ],
  [ContentPreferenceType.Word]: [],
};

// TODO fix api.new-notification-mail condition to handle all types when follow phase 3 is implemented
export const contentPreferenceNotificationTypes = Object.values(
  entityToNotificationTypeMap.user,
).flat();

export const cleanContentNotificationPreference = async ({
  ctx,
  entityManager,
  id,
  notificationTypes,
  notficationEntity,
  userId,
}: {
  ctx?: AuthContext;
  entityManager?: DataSource | EntityManager;
  id: string;
  notificationTypes: NotificationType[];
  notficationEntity: EntityTarget<NotificationPreference>;
  userId: string;
}) => {
  if (!entityManager && !ctx) {
    logger.error(
      'cleanContentNotificationPreference: ctx and entityManager are both undefined',
    );
    return;
  }
  const notificationRepository = (entityManager ?? ctx?.con)?.getRepository(
    notficationEntity,
  );

  if (!notificationRepository || !notificationTypes.length) {
    return;
  }

  await notificationRepository.delete({
    userId,
    referenceId: id,
    notificationType: In(notificationTypes),
    status: Not(NotificationPreferenceStatus.Muted),
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
      feedId: ctx.userId,
      referenceId: id,
      referenceUserId: id,
      status,
      type: ContentPreferenceType.User,
    });

    await repository.save(contentPreference);

    if (status !== ContentPreferenceStatus.Subscribed) {
      cleanContentNotificationPreference({
        ctx,
        entityManager,
        id,
        notificationTypes: entityToNotificationTypeMap.user,
        notficationEntity: NotificationPreferenceUser,
        userId: ctx.userId,
      });
    }
  });
};

const unfollowUser: UnFollowEntity = async ({ ctx, id }) => {
  await ctx.con.transaction(async (entityManager) => {
    const repository = entityManager.getRepository(ContentPreferenceUser);

    await repository.delete({
      userId: ctx.userId,
      feedId: ctx.userId,
      referenceId: id,
    });

    cleanContentNotificationPreference({
      ctx,
      entityManager,
      id,
      notificationTypes: entityToNotificationTypeMap.user,
      notficationEntity: NotificationPreferenceUser,
      userId: ctx.userId,
    });
  });
};

const followKeyword: FollowEntity = async ({ ctx, id, status }) => {
  await ctx.con.transaction(async (entityManager) => {
    const repository = entityManager.getRepository(ContentPreferenceKeyword);

    const contentPreference = repository.create({
      userId: ctx.userId,
      referenceId: id,
      keywordId: id,
      feedId: ctx.userId,
      status,
      type: ContentPreferenceType.Keyword,
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
    const repository = entityManager.getRepository(ContentPreferenceKeyword);

    await repository.delete({
      userId: ctx.userId,
      feedId: ctx.userId,
      referenceId: id,
    });

    // TODO follow phase 3 remove when backward compatibility is done
    await entityManager.getRepository(FeedTag).delete({
      feedId: ctx.userId,
      tag: id,
    });
  });
};

const unfollowWord: UnFollowEntity = async ({ ctx, id }) => {
  const repository = ctx.getRepository(ContentPreferenceWord);

  await repository.delete({
    userId: ctx.userId,
    feedId: ctx.userId,
    referenceId: id,
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
      flags: {
        referralToken: randomUUID(),
        role: SourceMemberRoles.Member,
      },
    });

    await repository
      .createQueryBuilder()
      .insert()
      .into(ContentPreferenceSource)
      .values(contentPreference)
      .orUpdate(['status'], ['referenceId', 'userId', 'type', 'feedId'])
      .execute();

    if (status !== ContentPreferenceStatus.Subscribed) {
      cleanContentNotificationPreference({
        ctx,
        entityManager,
        id,
        notificationTypes: entityToNotificationTypeMap.source,
        notficationEntity: NotificationPreferenceSource,
        userId: ctx.userId,
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
      feedId: ctx.userId,
      referenceId: id,
    });

    cleanContentNotificationPreference({
      ctx,
      entityManager,
      id,
      notificationTypes: entityToNotificationTypeMap.source,
      notficationEntity: NotificationPreferenceSource,
      userId: ctx.userId,
    });

    await entityManager.getRepository(FeedSource).delete({
      feedId: ctx.userId,
      sourceId: id,
    });
  });
};

const blockUser: BlockEntity = async ({ ctx, id }) => {
  if (ctx.userId === id) {
    throw new ConflictError('Cannot block yourself');
  }

  if (ghostUser.id === id) {
    throw new ConflictError('Cannot block this user');
  }

  await ctx.con.transaction(async (entityManager) => {
    const repository = entityManager.getRepository(ContentPreferenceUser);

    const contentPreference = repository.create({
      userId: ctx.userId,
      feedId: ctx.userId,
      referenceId: id,
      referenceUserId: id,
      status: ContentPreferenceStatus.Blocked,
      type: ContentPreferenceType.User,
    });

    await repository.save(contentPreference);

    cleanContentNotificationPreference({
      ctx,
      entityManager,
      id,
      notificationTypes: entityToNotificationTypeMap.user,
      notficationEntity: NotificationPreferenceUser,
      userId: ctx.userId,
    });
  });
};

const blockKeyword: BlockEntity = async ({ ctx, id }) => {
  await ctx.con.transaction(async (entityManager) => {
    const repository = entityManager.getRepository(ContentPreferenceKeyword);

    const contentPreference = repository.create({
      userId: ctx.userId,
      referenceId: id,
      keywordId: id,
      feedId: ctx.userId,
      status: ContentPreferenceStatus.Blocked,
      type: ContentPreferenceType.Keyword,
    });

    await repository.save(contentPreference);

    // TODO follow phase 3 remove when backward compatibility is done
    await entityManager.getRepository(FeedTag).save({
      feedId: ctx.userId,
      tag: id,
      blocked: true,
    });
  });
};

/**
 * Block word
 * Accepts either a single word or a comma separated list of words
 * @param ctx
 * @param id
 */
const blockWord: BlockEntity = async ({ ctx, id }) => {
  const ids = uniqueifyArray(
    id
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );

  if (ids.length > 50) {
    throw new Error('Cannot block more than 50 words at a time');
  }

  await ctx.con
    .createQueryBuilder()
    .insert()
    .into(ContentPreferenceWord)
    .values(
      ids.map((id) => ({
        userId: ctx.userId,
        referenceId: id,
        feedId: ctx.userId,
        status: ContentPreferenceStatus.Blocked,
        type: ContentPreferenceType.Word,
      })) as ContentPreferenceWord[],
    )
    .orUpdate(['status'], ['referenceId', 'userId', 'type', 'feedId'])
    .execute();
};

const blockSource: BlockEntity = async ({ ctx, id }) => {
  await ctx.con.transaction(async (entityManager) => {
    const repository = entityManager.getRepository(ContentPreferenceSource);

    const contentPreference = repository.create({
      userId: ctx.userId,
      referenceId: id,
      sourceId: id,
      feedId: ctx.userId,
      status: ContentPreferenceStatus.Blocked,
      flags: {
        referralToken: randomUUID(),
        role: SourceMemberRoles.Member,
      },
    });

    await repository
      .createQueryBuilder()
      .insert()
      .into(ContentPreferenceSource)
      .values(contentPreference)
      .orUpdate(['status'], ['referenceId', 'userId', 'type', 'feedId'])
      .execute();

    cleanContentNotificationPreference({
      ctx,
      entityManager,
      id,
      notificationTypes: entityToNotificationTypeMap.source,
      notficationEntity: NotificationPreferenceSource,
      userId: ctx.userId,
    });

    // TODO follow phase 3 remove when backward compatibility is done
    await entityManager.getRepository(FeedSource).save({
      feedId: ctx.userId,
      sourceId: id,
      blocked: true,
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
    case ContentPreferenceType.Word:
      return unfollowWord({ ctx, id });
    default:
      throw new Error('Entity not supported');
  }
};

export const blockEntity = async ({
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
      return blockUser({ ctx, id });
    case ContentPreferenceType.Keyword:
      return blockKeyword({ ctx, id });
    case ContentPreferenceType.Source:
      return blockSource({ ctx, id });
    case ContentPreferenceType.Word:
      return blockWord({ ctx, id });
    default:
      throw new Error('Entity not supported');
  }
};

export const unblockEntity = async ({
  ctx,
  id,
  entity,
}: {
  ctx: AuthContext;
  id: string;
  entity: ContentPreferenceType;
}): Promise<void> => {
  // currently unblock is just like unfollow, eg. remove everything from db
  return unfollowEntity({ ctx, id, entity });
};
