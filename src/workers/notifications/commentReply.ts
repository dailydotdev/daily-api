import { messageToJson } from '../worker';
import { Comment } from '../../entity';
import { NotificationCommenterContext } from '../../notifications';
import { NotificationWorker } from './worker';

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
      relations: ['post', 'parent', 'user'],
    });
    if (!comment) {
      return;
    }
    const parent = await comment.parent;
    const post = await comment.post;
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
          post.authorId ?? '',
          post.scoutId ?? '',
        ],
      })
      .getRawMany();
    const ctx: Omit<NotificationCommenterContext, 'userId'> = {
      post,
      comment,
      commenter,
    };
    return [parent.userId, ...threadFollowers.map(({ userId }) => userId)].map(
      (userId) => ({
        type: 'comment_reply',
        ctx: { ...ctx, userId },
      }),
    );
  },
};

export default worker;
