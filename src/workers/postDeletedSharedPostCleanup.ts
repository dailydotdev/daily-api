import { messageToJson, Worker } from './worker';
import { Post, SharePost } from '../entity/';
import { ChangeObject } from '../types';
import {
  DELETED_BY_WORKER,
  deletedPost,
  updateFlagsStatement,
} from '../common';
import { Not, IsNull } from 'typeorm';

interface Data {
  post: ChangeObject<Post>;
}

/**
 * This worker is responsible for managing shared post state when referenced post is deleted.
 * Rules:
 * - When a post is deleted, all shared posts referencing it should be set to link to DELETED_POST
 * - Shared posts with DELETED_POST should not show on feed
 * - Shared posts with DELETED_POST and no commentary should be soft deleted as well but not decrease reputation
 */
const worker: Worker = {
  subscription: 'api.post-deleted-shared-post-cleanup',
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
        'failed to cleanup shared post due to post deletion error',
      );
    }

    await Promise.all([
      await con
        .getRepository(SharePost)
        .createQueryBuilder()
        .update()
        .where({
          sharedPostId: post.id,
          title: IsNull(),
        })
        .set({
          deleted: true,
          showOnFeed: false,
          sharedPostId: deletedPost.id,
          flags: updateFlagsStatement<Post>({
            showOnFeed: false,
            deletedBy: DELETED_BY_WORKER,
          }),
        })
        .execute(),
      await con
        .getRepository(SharePost)
        .createQueryBuilder()
        .update()
        .where({
          sharedPostId: post.id,
          title: Not(IsNull()),
        })
        .set({
          showOnFeed: false,
          sharedPostId: deletedPost.id,
          flags: updateFlagsStatement<Post>({
            showOnFeed: false,
          }),
        })
        .execute(),
    ]);

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
