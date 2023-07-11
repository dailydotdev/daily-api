import { Post } from '../entity';

export const truncatePostToTweet = (post: Pick<Post, 'title'>): string => {
  if (!post || !post.title?.length) return '';

  return post.title.length <= 130
    ? post.title
    : `${post.title.substring(0, 127)}...`;
};
