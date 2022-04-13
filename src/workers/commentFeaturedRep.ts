import { messageToJson, Worker } from './worker';
import { Comment } from '../entity';
import { increaseReputation } from '../common';

interface Data {
  commentId: string;
}

const worker: Worker = {
  subscription: 'comment-featured-rep',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    try {
      const comment = await con.getRepository(Comment).findOne(data.commentId);
      await increaseReputation(con, logger, comment.userId, 2);
      logger.info(
        {
          data,
          messageId: message.messageId,
        },
        'increased reputation due to featured comment',
      );
    } catch (err) {
      logger.error(
        {
          data,
          messageId: message.messageId,
          err,
        },
        'failed to increase reputation due to upvote',
      );
    }
  },
};

export default worker;
