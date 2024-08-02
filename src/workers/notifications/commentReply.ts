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
    const [parent, commenter, mutes] = await Promise.all([
      comment.parent,
      comment.user,
      con.getRepository(NotificationPreferenceComment).findBy({
        referenceId: comment.id,
        notificationType: In(commentReplyNotificationTypes),
      }),
    ]);
    const threadFollowers = await con
      .getRepository(Comment)
      .createQueryBuilder()
      .select('"userId"')
      .distinct(true)
      .where('"parentId" = :parentId', { parentId: parent.id })
      .andWhere('"userId" not in (:...exclude)', {
        exclude: [parent.userId, comment.userId],
      })
      .getRawMany();
    const ctx: Omit<NotificationCommenterContext, 'userIds'> = {
      ...postCtx,
      comment,
      commenter,
    };
    const userIds = threadFollowers.map(({ userId }) => userId);
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
