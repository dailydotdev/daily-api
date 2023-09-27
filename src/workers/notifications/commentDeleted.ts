import { messageToJson, Worker } from '../worker';
import { Notification, Comment } from '../../entity';
import { ChangeObject } from '../../types';

interface Data {
  comment: ChangeObject<Comment>;
}

const worker: Worker = {
  subscription: 'api.comment-deleted-notification-cleanup',
  handler: async (message, con, logger) => {
    const data: Data = messageToJson(message);
    const { comment } = data;

    try {
      await con
        .getRepository(Notification)
        .createQueryBuilder()
        .delete()
        .where({
          referenceType: 'comment',
          referenceId: comment?.id,
        })
        .execute();
      logger.info(
        {
          data,
          messageId: message.messageId,
        },
        'deleted notifications due to comment deletion',
      );
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.messageId,
          err,
        },
        'failed to delete notifications due to comment deletion',
      );
    }
  },
};

export default worker;
