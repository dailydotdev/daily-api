import { messageToJson } from '../worker';
import { Comment, CommentUpvote, SourceMember, SourceType } from '../../entity';
import {
  NotificationCommentContext,
  NotificationUpvotersContext,
} from '../../notifications';
import { NotificationType } from '../../notifications/common';
import { NotificationWorker } from './worker';
import { buildPostContext, UPVOTE_MILESTONES } from './utils';
import { Not } from 'typeorm';
import { SourceMemberRoles } from '../../roles';

interface Data {
  userId: string;
  commentId: string;
}

const worker: NotificationWorker = {
  subscription: 'api.comment-upvote-milestone-notification',
  handler: async (message, con) => {
    const data: Data = messageToJson(message);
    const comment = await con
      .getRepository(Comment)
      .findOne({ where: { id: data.commentId } });
    if (
      !comment ||
      comment.userId === data.userId ||
      !UPVOTE_MILESTONES.includes(comment.upvotes.toString())
    ) {
      return;
    }
    const postCtx = await buildPostContext(con, comment.postId);
    if (!postCtx) {
      return;
    }
    const { source } = postCtx;
    const upvotes = await con.getRepository(CommentUpvote).find({
      where: { commentId: comment.id },
      take: 5,
      order: { createdAt: 'desc' },
      relations: ['user'],
    });
    const upvoters = await Promise.all(upvotes.map((upvote) => upvote.user));
    const ctx: NotificationCommentContext & NotificationUpvotersContext = {
      ...postCtx,
      comment,
      upvoters,
      upvotes: comment.upvotes,
      userIds: [comment.userId],
    };

    if (source.type === SourceType.Squad) {
      const member = await con.getRepository(SourceMember).findOneBy({
        userId: comment.userId,
        sourceId: source.id,
        role: Not(SourceMemberRoles.Blocked),
      });

      if (!member) {
        return;
      }
    }

    return [{ type: NotificationType.CommentUpvoteMilestone, ctx }];
  },
};

export default worker;
