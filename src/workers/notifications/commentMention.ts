import { TypedNotificationWorker } from '../worker';
import { Comment, NotificationPreferenceComment } from '../../entity';
import {
  commentReplyNotificationTypes,
  NotificationPreferenceStatus,
  NotificationType,
} from '../../notifications/common';
import { buildPostContext } from './utils';
import { In } from 'typeorm';

export const commentMention: TypedNotificationWorker<'api.v1.new-comment-mention'> =
  {
    subscription: 'api.comment-mention-notification',
    handler: async ({ commentMention }, con) => {
      const repo = con.getRepository(Comment);
      const comment = await repo.findOne({
        where: { id: commentMention.commentId },
        relations: ['user'],
      });
      if (!comment || comment.flags?.vordr) {
        return;
      }
      const postCtx = await buildPostContext(con, comment.postId);
      if (!postCtx) {
        return;
      }
      const authors = new Set([postCtx.post.authorId, postCtx.post.scoutId]);
      if (authors.has(commentMention.mentionedUserId)) {
        return;
      }
      const [parenterCommenter, mute] = await Promise.all([
        comment.parentId &&
          repo.findOneBy({
            id: comment.parentId,
            userId: commentMention.mentionedUserId,
          }),
        con.getRepository(NotificationPreferenceComment).findOneBy({
          referenceId: In([comment.id, comment.parentId ?? '']),
          notificationType: In(commentReplyNotificationTypes),
          userId: commentMention.mentionedUserId,
          status: NotificationPreferenceStatus.Muted,
        }),
      ]);
      if (parenterCommenter || mute) {
        return;
      }
      const commenter = await comment.user;
      return [
        {
          type: NotificationType.CommentMention,
          ctx: {
            ...postCtx,
            userIds: [commentMention.mentionedUserId],
            commenter,
            comment,
            initiatorId: commenter.id,
          },
        },
      ];
    },
  };
