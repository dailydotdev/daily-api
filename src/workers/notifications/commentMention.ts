import { messageToJson } from '../worker';
import {
  Comment,
  CommentMention,
  NotificationPreferenceComment,
} from '../../entity';
import {
  commentReplyNotificationTypes,
  NotificationPreferenceStatus,
  NotificationType,
} from '../../notifications/common';
import { NotificationWorker } from './worker';
import { ChangeObject } from '../../types';
import { buildPostContext } from './utils';
import { In } from 'typeorm';

export interface Data {
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
    if (!comment || comment.flags?.vordr) {
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
    const [parenterCommenter, mute] = await Promise.all([
      comment.parentId &&
        repo.findOneBy({
          id: comment.parentId,
          userId: data.commentMention.mentionedUserId,
        }),
      con.getRepository(NotificationPreferenceComment).findOneBy({
        referenceId: In([comment.id, comment.parentId ?? '']),
        notificationType: In(commentReplyNotificationTypes),
        userId: data.commentMention.mentionedUserId,
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
          userIds: [data.commentMention.mentionedUserId],
          commenter,
          comment,
        },
      },
    ];
  },
};

export default worker;
