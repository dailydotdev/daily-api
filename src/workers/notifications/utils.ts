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

export const UPVOTE_TITLES = {
  1: 'Congrats! You just <span class="text-theme-color-avocado">earned one upvote 🎉</span>',
  3: 'Yay! You <span class="text-theme-color-avocado">earned 3 upvotes ✨</span>',
  5: 'You rock! You <span class="text-theme-color-avocado">earned 5 upvotes 🎸</span>',
  10: 'Well done! You <span class="text-theme-color-avocado">earned 10 upvotes 🙌</span>',
  20: 'Brilliant! You <span class="text-theme-color-avocado">earned 20 upvotes 🥳</span>',
  50: 'Good job! You <span class="text-theme-color-avocado">earned 50 upvotes 🚴‍♀️</span>',
  100: 'Excellent! You <span class="text-theme-color-avocado">earned 100 upvotes ⚡️</span>',
  200: 'Way to go! You <span class="text-theme-color-avocado">earned 200 upvotes 🚀</span>',
  500: 'Clever! You <span class="text-theme-color-avocado">earned 500 upvotes 🦸‍</span>',
  1000: 'Superb! You <span class="text-theme-color-avocado">earned 1,000 upvotes 😱</span>',
  1250: 'Wow! You <span class="text-theme-color-avocado">earned 1,250 upvotes 💥</span>',
  1500: 'Unbelievable! You <span class="text-theme-color-avocado">earned 1,500 upvotes 🤯</span>',
  5000: 'Awesome! You <span class="text-theme-color-avocado">earned 5,000 upvotes 😳</span>',
  7500: 'Legendary! You <span class="text-theme-color-avocado">earned 7,500 upvotes 🏎</span>',
  10000: `We're speechless! You <span class="text-theme-color-avocado">earned 10,000 upvotes 🙉</span>`,
};
export const UPVOTE_MILESTONES = Object.keys(UPVOTE_TITLES);
