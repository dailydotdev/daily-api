import { NotificationHandlerReturn } from './worker';
import { Comment, Post, SharePost } from '../../entity';
import {
  NotificationCommenterContext,
  NotificationPostContext,
} from '../../notifications';
import { DataSource } from 'typeorm';

export const uniquePostOwners = (
  post: Pick<Post, 'scoutId' | 'authorId'>,
  exclude?: string,
): string[] =>
  [...new Set([post.scoutId, post.authorId])].filter(
    (userId) => userId && userId !== exclude,
  );

export const buildPostContext = async (
  con: DataSource,
  postId: string,
): Promise<Omit<NotificationPostContext, 'userId'> | null> => {
  const post = await con
    .getRepository(Post)
    .findOne({ where: { id: postId }, relations: ['source'] });
  let sharedPost: Post;
  if (post.type === 'share') {
    sharedPost = await con
      .getRepository(Post)
      .findOneBy({ id: (post as SharePost).sharedPostId });
  }
  if (post) {
    return {
      post,
      source: await post.source,
      sharedPost,
    };
  }
  return null;
};

export async function articleNewCommentHandler(
  con: DataSource,
  commentId: string,
): Promise<NotificationHandlerReturn> {
  const comment = await con
    .getRepository(Comment)
    .findOne({ where: { id: commentId }, relations: ['user'] });
  if (!comment) {
    return;
  }
  const postCtx = await buildPostContext(con, comment.postId);
  if (!postCtx) {
    return;
  }
  // Get unique user id which are not the author of the comment
  const users = uniquePostOwners(postCtx.post, comment.userId);
  if (!users.length) {
    return;
  }

  const commenter = await comment.user;
  const ctx: Omit<NotificationCommenterContext, 'userId'> = {
    ...postCtx,
    commenter,
    comment,
  };
  return users.map((userId) => ({
    type: 'article_new_comment',
    ctx: { ...ctx, userId },
  }));
}

export const UPVOTE_MILESTONES = [
  1, 3, 5, 10, 20, 50, 100, 200, 500, 1000, 1250, 1500, 5000, 7500, 10000,
];
