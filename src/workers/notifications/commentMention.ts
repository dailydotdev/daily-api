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
    const repo = con.getRepository(Comment);
    const comment = await repo.findOne({
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
    const authors = new Set([postCtx.post.authorId, postCtx.post.scoutId]);
    if (authors.has(data.commentMention.mentionedUserId)) {
      return;
    }
    const parent = comment.parentId && (await comment.parent);
    if (data.commentMention.mentionedUserId === parent?.userId) {
      return;
    }
    const threadFollower = await repo.findOneBy({
      userId: data.commentMention.mentionedUserId,
      parentId: comment.parentId,
    });
    if (threadFollower) {
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
