import { TypedNotificationWorker } from '../worker';
import { Comment, SourceMember, SourceType } from '../../entity';
import {
  NotificationCommentContext,
  NotificationUpvotersContext,
} from '../../notifications';
import { NotificationType } from '../../notifications/common';
import { buildPostContext, UPVOTE_MILESTONES } from './utils';
import { Not } from 'typeorm';
import { SourceMemberRoles } from '../../roles';
import { UserComment } from '../../entity/user/UserComment';
import { UserVote } from '../../types';

export const commentUpvoteMilestone: TypedNotificationWorker<'comment-upvoted'> =
  {
    subscription: 'api.comment-upvote-milestone-notification',
    handler: async ({ commentId, userId }, con) => {
      const comment = await con
        .getRepository(Comment)
        .findOne({ where: { id: commentId } });
      if (
        !comment ||
        comment.userId === userId ||
        !UPVOTE_MILESTONES.includes(comment.upvotes.toString())
      ) {
        return;
      }
      const postCtx = await buildPostContext(con, comment.postId);
      if (!postCtx) {
        return;
      }
      const { source } = postCtx;
      const upvotes = await con.getRepository(UserComment).find({
        where: { commentId: comment.id, vote: UserVote.Up },
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
