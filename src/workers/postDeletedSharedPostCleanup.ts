import { messageToJson, Worker } from './worker';
import { Post, SharePost } from '../entity/';
import { ChangeObject } from '../types';
import { updateFlagsStatement } from '../common';

interface Data {
  post: ChangeObject<Post>;
}

const worker: Worker = {
  subscription: 'api.post-deleted-shared-post-cleanup',
  handler: async (message, con, logger): Promise<void> => {
    const data: Data = messageToJson(message);
    const { post } = data;

    const databasePost = await con
      .getRepository(Post)
      .findOneBy({ id: post?.id });
    console.log('del: ', databasePost?.deleted);
    if (!databasePost || !databasePost?.deleted) {
      return logger.info(
        {
          data,
          messageId: message.messageId,
        },
        'failed to cleanup shared post due to post deletion error',
      );
    }

    await con
      .getRepository(SharePost)
      .createQueryBuilder()
      .update()
      .where({
        sharedPostId: post.id,
      })
      .set({
        showOnFeed: false,
        flags: updateFlagsStatement<Post>({
          showOnFeed: false,
        }),
      })
      .execute();

    logger.info(
      {
        data,
        messageId: message.messageId,
      },
      'set shared post to not show on feed due to post deletion',
    );
  },
};

export default worker;
