import { messageToJson, Worker } from './worker';
import {
  Alerts,
  Bookmark,
  BookmarkList,
  Comment,
  Post,
  User,
  View,
} from '../entity';
import { CommentUpvote } from '../entity/CommentUpvote';
import { DevCard } from '../entity/DevCard';
import { Feed } from '../entity/Feed';
import { HiddenPost } from '../entity/HiddenPost';
import { PostReport } from '../entity/PostReport';
import { Settings } from '../entity/Settings';
import { SourceDisplay } from '../entity/SourceDisplay';
import { SourceRequest } from '../entity/SourceRequest';
import { Upvote } from '../entity/Upvote';
import { FastifyLoggerInstance } from 'fastify';
import { Connection } from 'typeorm';

interface UserData {
  id: string;
  name: string;
  email: string;
  image: string;
  company?: string;
  title?: string;
  infoConfirmed: boolean;
  username?: string;
  bio?: string;
  twitter?: string;
  github?: string;
  createdAt: Date;
  acceptedMarketing: boolean;
  portfolio?: string;
  hashnode?: string;
  timezone?: string;
  kratosUser?: boolean;
}

export const deleteUser = async (
  con: Connection,
  logger: FastifyLoggerInstance,
  userId: string,
  messageId?: string,
) => {
  try {
    await con.transaction(async (entityManager): Promise<void> => {
      await entityManager.getRepository(View).delete({ userId });
      await entityManager.getRepository(Alerts).delete({ userId });
      await entityManager.getRepository(BookmarkList).delete({ userId });
      await entityManager.getRepository(Bookmark).delete({ userId });
      await entityManager.getRepository(CommentUpvote).delete({ userId });
      await entityManager.getRepository(Comment).delete({ userId });
      await entityManager.getRepository(DevCard).delete({ userId });
      await entityManager.getRepository(Feed).delete({ userId });
      await entityManager.getRepository(HiddenPost).delete({ userId });
      await entityManager.getRepository(PostReport).delete({ userId });
      await entityManager.getRepository(Settings).delete({ userId });
      await entityManager.getRepository(SourceDisplay).delete({ userId });
      await entityManager.getRepository(SourceRequest).delete({ userId });
      await entityManager.getRepository(Upvote).delete({ userId });
      await entityManager
        .getRepository(Post)
        .update({ authorId: userId }, { authorId: null });
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

const worker: Worker = {
  subscription: 'user-deleted-api',
  handler: async (message, con, logger): Promise<void> => {
    const data: UserData = messageToJson(message);
    // Kratos users are already deleted, this is only to support gateway deletion
    if (data.kratosUser) return;
    await deleteUser(con, logger, data.id, message.messageId);
  },
};

export default worker;
