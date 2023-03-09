import { Post } from '../entity';

export const truncatePostToTweet = (post: Pick<Post, 'title'>): string =>
  post.title.length <= 130 ? post.title : `${post.title.substring(0, 127)}...`;
