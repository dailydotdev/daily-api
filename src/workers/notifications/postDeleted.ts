import { messageToJson, Worker } from '../worker';
import { Notification, Post } from '../../entity';
import { ChangeObject } from '../../types';

interface Data {
  post: ChangeObject<Post>;
}

const worker: Worker = {
  subscription: 'api.post-deleted-notification-cleanup',
  handler: async (message, con, logger) => {
    const data: Data = messageToJson(message);
    const { post } = data;

    const databasePost = await con
      .getRepository(Post)
      .findOneBy({ id: post?.id });
    if (!databasePost || !databasePost?.deleted) {
      return logger.error(
        {
          data,
          messageId: message.messageId,
        },
        'failed to delete notifications due to post deletion',
      );
    }

    await con
      .getRepository(Notification)
      .createQueryBuilder()
      .delete()
      .where({
        referenceType: 'post',
        referenceId: post.id,
      })
      .execute();
    logger.info(
      {
        data,
        messageId: message.messageId,
      },
      'deleted notifications due to post deletion',
    );
  },
};

export default worker;
