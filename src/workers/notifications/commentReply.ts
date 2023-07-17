import { messageToJson } from '../worker';
import { Comment, SourceType } from '../../entity';
import {
  NotificationCommenterContext,
  NotificationType,
} from '../../notifications';
import { NotificationWorker } from './worker';
import { buildPostContext } from './utils';

interface Data {
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
    const postCtx = await buildPostContext(con, comment.postId);
    if (!postCtx) {
      return;
    }
    const parent = await comment.parent;
    const commenter = await comment.user;
    const threadFollowers = await con
      .getRepository(Comment)
      .createQueryBuilder()
      .select('"userId"')
      .distinct(true)
      .where('"parentId" = :parentId', { parentId: parent.id })
      .andWhere('"userId" not in (:...exclude)', {
        exclude: [
          parent.userId,
          comment.userId,
          postCtx.post.authorId ?? '',
          postCtx.post.scoutId ?? '',
        ],
      })
      .getRawMany();
    const ctx: Omit<NotificationCommenterContext, 'userId'> = {
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
    return userIds.map((userId) => ({
      type,
      ctx: { ...ctx, userId },
    }));
  },
};

export default worker;
