import { addNewPost, AddPostData } from '../entity';
import { messageToJson, Worker } from './worker';

const worker: Worker = {
  subscription: 'add-posts-v2',
  handler: async (message, con, logger): Promise<void> => {
    const data: AddPostData = messageToJson(message);
    try {
      const res = await addNewPost(con, data);
      if (res.status === 'ok') {
        logger.info(
          {
            post: data,
            messageId: message.messageId,
          },
          'added successfully post',
        );
      } else if (res.error) {
        logger.error(
          {
            post: data,
            messageId: message.messageId,
            err: res.error,
          },
          'failed to add post to db',
        );
      } else if (res.reason === 'exists') {
        logger.info(
          {
            post: data,
            messageId: message.messageId,
          },
          'post url already exists',
        );
      } else if (res.reason === 'author banned') {
        logger.info(
          {
            post: data,
            messageId: message.messageId,
          },
          'author is banned',
        );
      }
    } catch (err) {
      logger.error(
        {
          post: data,
          messageId: message.messageId,
          err,
        },
        'failed to add post to db',
      );
      // Foreign / index row size
      if (err?.code === '23503' || err?.code === '54000') {
        return;
      }
      throw err;
    }
  },
};

export default worker;
