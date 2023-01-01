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

export const UPVOTE_TITLES = {
  1: 'Congrats! You just <span class="text-theme-color-avocado">earned 1 upvote 🎉</span>',
  3: 'Wow! You <span class="text-theme-color-avocado">earned 3 upvotes ✨</span>',
  5: 'You rock! You <span class="text-theme-color-avocado">earned 5 upvotes 🎸</span>',
  10: 'Well done! You <span class="text-theme-color-avocado">earned 10 upvotes 🙌</span>',
  20: 'Brilliant! You <span class="text-theme-color-avocado">earned 20 upvotes 🥳</span>',
  50: 'Good job! You <span class="text-theme-color-avocado">earned 50 upvotes 🚴‍♀️</span>',
  100: 'Excellent! You <span class="text-theme-color-avocado">earned 100 upvotes ⚡️</span>',
  200: 'Way to go! You <span class="text-theme-color-avocado">earned 200 upvotes 🚀</span>',
  500: 'Clever! You <span class="text-theme-color-avocado">earned 500 upvotes 🦸‍</span>',
  1000: 'Superb! You <span class="text-theme-color-avocado">earned 1,000 upvotes 😱</span>',
  2000: 'Legendary! You <span class="text-theme-color-avocado">earned 2,000 upvotes 💥</span>',
  5000: 'Unbelievable! You <span class="text-theme-color-avocado">earned 5,000 upvotes 😳</span>',
  10000: `We're speechless! You <span class="text-theme-color-avocado">earned 10,000 upvotes 🙉</span>`,
};
export const UPVOTE_MILESTONES = Object.keys(UPVOTE_TITLES);
