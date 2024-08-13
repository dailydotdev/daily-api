import { TypedWorker } from './worker';
import { Comment } from '../entity';
import { notifyNewVordrComment } from '../common';
import { TypeORMQueryFailedError } from '../errors';
import { logger } from '../logger';

export const vordrPostCommentPrevented: TypedWorker<'post-commented'> = {
  subscription: 'api.vordr-post-comment-prevented',
  handler: async ({ data }, con): Promise<void> => {
    try {
      const comment = await con
        .getRepository(Comment)
        .findOne({ where: { id: data.commentId }, relations: ['post'] });

      if (!comment.flags?.vordr) {
        return;
      }

      const post = await comment.post;
      if (post.private) {
        return;
      }
      const user = await comment.user;

      await notifyNewVordrComment(post, user, comment);
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
