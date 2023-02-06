import { messageToJson } from '../worker';
import { Comment, CommentMention } from '../../entity';
import { NotificationCommenterContext } from '../../notifications';
import { NotificationWorker } from './worker';
import { ChangeObject } from '../../types';
import { buildPostContext } from './utils';

interface Data {
  commentMention: ChangeObject<CommentMention>;
}

const worker: NotificationWorker = {
  subscription: 'api.comment-mention-notification',
  handler: async (message, con) => {
    const data: Data = messageToJson(message);
    const comment = await con.getRepository(Comment).findOne({
      where: { id: data.commentMention.commentId },
      relations: ['user'],
    });
    if (!comment) {
      return;
    }
    const postCtx = await buildPostContext(con, comment.postId);
    if (!postCtx) {
      return;
    }
    const authors = [postCtx.post.authorId, postCtx.post.scoutId];
    if (authors.includes(data.commentMention.mentionedUserId)) {
      return;
    }
    const commenter = await comment.user;
    const ctx: NotificationCommenterContext = {
      ...postCtx,
      userId: data.commentMention.mentionedUserId,
      commenter,
      comment,
    };
    return [{ type: 'comment_mention', ctx }];
  },
};

export default worker;
