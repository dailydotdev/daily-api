import { NotificationHandlerReturn } from './worker';
import { Comment, Post } from '../../entity';
import { NotificationCommenterContext } from '../../notifications';
import { DataSource } from 'typeorm';

export const uniquePostOwners = (post: Post, exclude?: string): string[] =>
  [...new Set([post.scoutId, post.authorId])].filter(
    (userId) => userId && userId !== exclude,
  );

export async function articleNewCommentHandler(
  con: DataSource,
  commentId: string,
): Promise<NotificationHandlerReturn> {
  const comment = await con
    .getRepository(Comment)
    .findOne({ where: { id: commentId }, relations: ['post', 'user'] });
  if (!comment) {
    return;
  }
  const post = await comment.post;
  // Get unique user id which are not the author of the comment
  const users = uniquePostOwners(post, comment.userId);
  if (!users.length) {
    return;
  }

  const commenter = await comment.user;
  const ctx: Omit<NotificationCommenterContext, 'userId'> = {
    post,
    commenter,
    comment,
  };
  return users.map((userId) => ({
    type: 'article_new_comment',
    ctx: { ...ctx, userId },
  }));
}

export const UPVOTE_MILESTONES = [
  1, 2, 3, 4, 5, 10, 20, 50, 100, 200, 500, 1000, 1250, 1500, 5000, 7500, 10000,
];
