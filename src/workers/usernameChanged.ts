import { TypeORMQueryFailedError } from '../errors';
import { notifyCommentsUpdate } from './../common/pubsub';
import { CommentMention } from './../entity/CommentMention';
import { messageToJson, Worker } from './worker';

interface Data {
  userId: string;
  oldUsername: string;
  newUsername: string;
}

const limit = parseInt(process.env.COMMENT_BATCH_UPDATE_LIMIT || '50');

const worker: Worker = {
  subscription: 'username-changed-api',
  handler: async (message, con, logger): Promise<void> => {
    const { userId, oldUsername, newUsername }: Data = messageToJson(message);
    try {
      const commentMentions = await con
        .getRepository(CommentMention)
        .findBy({ mentionedUserId: userId });
      const commentIds = commentMentions.map((mention) => mention.commentId);
      const slices = commentIds.length / limit + 1;
      const batches = [];
      for (let slice = 0; slice < slices; slice++) {
        const start = slice * limit;
        const end = (slice + 1) * limit;
        batches.push(commentIds.slice(start, end));
      }
      await Promise.all(
        batches.map((batch) =>
          notifyCommentsUpdate(logger, oldUsername, newUsername, batch),
        ),
      );
      logger.info(
        {
          userId,
          messageId: message.messageId,
        },
        'updated username',
      );
    } catch (originalError) {
      const err = originalError as TypeORMQueryFailedError;

      logger.error(
        {
          userId,
          messageId: message.messageId,
          err,
        },
        'failed to trigger updating comments',
      );
      if (err.name === 'QueryFailedError') {
        return;
      }
      throw err;
    }
  },
};

export default worker;
