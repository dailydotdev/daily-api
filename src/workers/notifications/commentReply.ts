import { TypedNotificationWorker } from '../worker';
import {
  Comment,
  NotificationPreferenceComment,
  SourceType,
} from '../../entity';
import { NotificationCommenterContext } from '../../notifications';
import {
  commentReplyNotificationTypes,
  NotificationPreferenceStatus,
  NotificationType,
} from '../../notifications/common';
import { buildPostContext } from './utils';
import { In } from 'typeorm';

export const commentReply: TypedNotificationWorker<'comment-commented'> = {
  subscription: 'api.comment-reply-notification',
  handler: async ({ childCommentId }, con) => {
    const comment = await con.getRepository(Comment).findOne({
      where: { id: childCommentId },
      relations: ['parent', 'user'],
    });
    if (!comment || comment.flags?.vordr) {
      return;
    }
    const postCtx = await buildPostContext(con, comment.postId);
    if (!postCtx) {
      return;
    }
    const [parent, commenter] = await Promise.all([
      comment.parent,
      comment.user,
    ]);

    const mutes = await con
      .getRepository(NotificationPreferenceComment)
      .findBy({
        referenceId: In([comment.id, parent.id]),
        notificationType: In(commentReplyNotificationTypes),
        status: NotificationPreferenceStatus.Muted,
      });

    const ctx: Omit<NotificationCommenterContext, 'userIds'> = {
      ...postCtx,
      comment,
      commenter,
    };
    const userIds = [];
    if (comment.userId !== parent.userId) {
      userIds.push(parent.userId);
    }
    const type =
      ctx.source.type === SourceType.Squad
        ? NotificationType.SquadReply
        : NotificationType.CommentReply;
    return [
      {
        type,
        ctx: {
          ...ctx,
          initiatorId: commenter.id,
          userIds: userIds.filter((id) =>
            mutes.every(({ userId }) => userId !== id),
          ),
        },
      },
    ];
  },
};
