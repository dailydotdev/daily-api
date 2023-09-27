import { messageToJson, Worker } from '../worker';
import { Notification, Comment, Post } from '../../entity';
import { ChangeObject } from '../../types';

interface Data {
  comment: ChangeObject<Comment>;
}

const worker: Worker = {
  subscription: 'api.comment-deleted-notification-cleanup',
  handler: async (message, con, logger) => {
    const data: Data = messageToJson(message);
    const { comment } = data;

    const databaseComment = await con
      .getRepository(Comment)
      .findOneBy({ id: comment?.id });
    if (!databaseComment) {
      return logger.error(
        {
          data,
          messageId: message.messageId,
        },
        'failed to delete notifications due to comment deletion',
      );
    }

    await con
      .getRepository(Notification)
      .createQueryBuilder()
      .delete()
      .where({
        referenceType: 'comment',
        referenceId: comment.id,
      })
      .execute();
    logger.info(
      {
        data,
        messageId: message.messageId,
      },
      'deleted notifications due to comment deletion',
    );
  },
};

export default worker;
