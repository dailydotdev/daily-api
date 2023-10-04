import { messageToJson, Worker } from './worker';
import { Comment, Post } from '../entity/';
import { ChangeObject } from '../types';

interface Data {
  post: ChangeObject<Post>;
}

const worker: Worker = {
  subscription: 'api.post-deleted-comments-cleanup',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    const { post } = data;

    const databasePost = await con
      .getRepository(Post)
      .findOneBy({ id: post?.id });
    if (!databasePost || !databasePost?.deleted) {
      return logger.info(
        {
          data,
          messageId: message.messageId,
        },
        'failed to delete comments due to post deletion',
      );
    }

    await con
      .getRepository(Comment)
      .createQueryBuilder()
      .delete()
      .where({
        postId: post.id,
      })
      .execute();

    logger.info(
      {
        data,
        messageId: message.messageId,
      },
      'deleted comments due to post deletion',
    );
  },
};

export default worker;
