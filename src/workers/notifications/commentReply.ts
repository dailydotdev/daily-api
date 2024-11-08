import { messageToJson } from '../worker';
import {
  Comment,
  NotificationPreferenceComment,
  SourceType,
} from '../../entity';
import { NotificationCommenterContext } from '../../notifications';
import {
  commentReplyNotificationTypes,
  NotificationType,
} from '../../notifications/common';
import { NotificationWorker } from './worker';
import { buildPostContext } from './utils';
import { In } from 'typeorm';

export interface Data {
  userId: string;
  childCommentId: string;
  postId: string;
}

const worker: NotificationWorker = {
  subscription: 'api.comment-reply-notification',
  handler: async (message, con) => {
    const data: Data = messageToJson(message);
    const comment = await con.getRepository(Comment).findOne({
      where: { id: data.childCommentId },
      relations: ['parent', 'user'],
    });
    if (!comment) {
      return;
    }
    if (comment.flags?.vordr) {
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
          userIds: userIds.filter((id) =>
            mutes.every(({ userId }) => userId !== id),
          ),
        },
      },
    ];
  },
};

export default worker;
