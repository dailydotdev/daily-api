import { DataSource } from 'typeorm';
import { FastifyLoggerInstance } from 'fastify';
import {
  Alerts,
  ArticlePost,
  Bookmark,
  BookmarkList,
  Comment,
  DevCard,
  Feed,
  Post,
  PostReport,
  Settings,
  SourceDisplay,
  SourceRequest,
  User,
  View,
} from '../entity';
import { ghostUser } from '../common';
import { cancelSubscription } from '../common/paddle';
import { logger } from '../logger';

export const deleteUser = async (
  con: DataSource,
  logger: FastifyLoggerInstance,
  userId: string,
  messageId?: string,
) => {
  try {
    const user = await con.getRepository(User).findOne({
      select: ['subscriptionFlags'],
      where: { id: userId },
    });
    if (user?.subscriptionFlags?.subscriptionId) {
      await cancelSubscription({
        subscriptionId: user.subscriptionFlags.subscriptionId,
      });
      logger.info(
        {
          type: 'paddle',
          userId,
          subscriptionId: user.subscriptionFlags.subscriptionId,
        },
        'Subscription cancelled user deletion',
      );
    }
    await con.transaction(async (entityManager): Promise<void> => {
      await entityManager.getRepository(View).delete({ userId });
      await entityManager.getRepository(Alerts).delete({ userId });
      await entityManager.getRepository(BookmarkList).delete({ userId });
      await entityManager.getRepository(Bookmark).delete({ userId });
      await entityManager.getRepository(Comment).update(
        { userId },
        {
          userId: ghostUser.id,
        },
      );
      await entityManager.getRepository(Comment).delete({ userId });
      await entityManager.getRepository(DevCard).delete({ userId });
      await entityManager.getRepository(Feed).delete({ userId });
      await entityManager.getRepository(PostReport).delete({ userId });
      await entityManager.getRepository(Settings).delete({ userId });
      await entityManager.getRepository(SourceDisplay).delete({ userId });
      await entityManager.getRepository(SourceRequest).delete({ userId });
      await entityManager
        .getRepository(ArticlePost)
        .update({ authorId: userId }, { authorId: null });
      // Manually set shared post to 404 dummy user
      await entityManager
        .getRepository(Post)
        .update({ authorId: userId }, { authorId: ghostUser.id });
      await entityManager
        .getRepository(Post)
        .update({ scoutId: userId }, { scoutId: null });
      await entityManager.getRepository(User).delete(userId);
    });
    if (logger) {
      logger.info(
        {
          userId,
          messageId,
        },
        'deleted user',
      );
    }
  } catch (err) {
    if (logger) {
      logger.error(
        {
          userId,
          messageId,
          err,
        },
        'failed to delete user',
      );
    }
    throw err;
  }
};
