import { Post } from '../entity';

export const truncateToTweet = (text?: string): string => {
  if (!text) return '';

  return text.length <= 130 ? text : `${text.substring(0, 127)}...`;
};

export const truncatePostToTweet = (
  post: Pick<Post, 'title'> | undefined,
): string => {
  if (!post || !post.title?.length) return '';

  return truncateToTweet(post.title);
};
