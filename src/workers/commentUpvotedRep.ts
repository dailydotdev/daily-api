import { envBasedName, messageToJson, Worker } from './worker';
import { Comment } from '../entity';
import { increaseReputation } from '../common';

interface Data {
  userId: string;
  commentId: string;
}

const worker: Worker = {
  topic: 'comment-upvoted',
  subscription: envBasedName('comment-upvoted-rep'),
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      const comment = await con.getRepository(Comment).findOne(data.commentId);
      if (comment.userId !== data.userId) {
        await increaseReputation(con, logger, comment.userId, 1);
        logger.info(
          {
            data,
            messageId: message.id,
          },
          'increased reputation due to upvote',
        );
      }
      message.ack();
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.id,
          err,
        },
        'failed to increase reputation due to upvote',
      );
      message.ack();
    }
  },
};

export default worker;
