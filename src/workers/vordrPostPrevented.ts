import { TypedWorker } from './worker';
import { Post, PostType, SharePost } from '../entity';
import { notifyNewVordrPost } from '../common';
import { TypeORMQueryFailedError } from '../errors';
import { logger } from '../logger';

export const vordrPostPrevented: TypedWorker<'api.v1.post-visible'> = {
  subscription: 'api.vordr-post-prevented',
  handler: async ({ data }, con): Promise<void> => {
    try {
      const post = await con.getRepository(Post).findOne({
        where: { id: data.post.id },
        relations: {
          author: true,
          scout: true,
        },
      });

      // Edge cases where the post is not found in the database
      if (!post) {
        return;
      }

      const author = await post.author;
      const scout = await post.scout;
      const sharedPost =
        post.type === PostType.Share
          ? await (post as SharePost).sharedPost
          : null;

      if (!post.flags?.vordr) {
        return;
      }

      if (post.private) {
        return;
      }

      await notifyNewVordrPost(post, author, scout, sharedPost);
    } catch (originalError) {
      const err = originalError as TypeORMQueryFailedError;

      logger.error(
        {
          data,
          err,
        },
        'failed to notify vordr post comment prevented',
      );
      throw err;
    }
  },
};
