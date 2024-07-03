import { TypeORMQueryFailedError } from '../errors';
import { updateMentions } from '../schema/comments';
import { messageToJson, Worker } from './worker';

interface Data {
  oldUsername: string;
  newUsername: string;
  commentIds: string[];
}

const worker: Worker = {
  subscription: 'update-comments-mention',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    const { oldUsername, newUsername, commentIds } = data;
    try {
      await con.transaction(async (entityManager) =>
        updateMentions(entityManager, oldUsername, newUsername, commentIds),
      );
      logger.info(
        {
          data,
          messageId: message.messageId,
        },
        'updated username',
      );
    } catch (originalError) {
      const err = originalError as TypeORMQueryFailedError;

      logger.error(
        {
          data,
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
