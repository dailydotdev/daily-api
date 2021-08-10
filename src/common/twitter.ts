import Twit from 'twit';
import { Post } from '../entity';
import { ChangeObject } from '../types';

export const truncatePostToTweet = (post: Post | ChangeObject<Post>): string =>
  post.title.length <= 130 ? post.title : `${post.title.substr(0, 127)}...`;

export const tweet = async (status: string, key = 'TWITTER'): Promise<void> => {
  const client = new Twit({
    consumer_key: process.env[`${key}_CONSUMER_KEY`],
    consumer_secret: process.env[`${key}_CONSUMER_SECRET`],
    access_token: process.env[`${key}_ACCESS_TOKEN_KEY`],
    access_token_secret: process.env[`${key}_ACCESS_TOKEN_SECRET`],
  });
  await client.post('statuses/update', { status });
};
