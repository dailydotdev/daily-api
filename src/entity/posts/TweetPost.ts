import { ChildEntity, Column, Index } from 'typeorm';
import { Post, PostType } from './Post';

export type TweetMedia = {
  type: 'photo' | 'video' | 'animated_gif';
  url: string;
  previewUrl?: string;
  width?: number;
  height?: number;
};

export type TweetData = {
  tweetId: string;
  content: string;
  contentHtml: string;
  createdAt?: Date;
};

@ChildEntity(PostType.Tweet)
export class TweetPost extends Post {
  @Column({ type: 'text' })
  @Index({ unique: true })
  tweetId: string;

  @Column({ type: 'text' })
  tweetAuthorUsername: string;

  @Column({ type: 'text' })
  tweetAuthorName: string;

  @Column({ type: 'text', nullable: true })
  tweetAuthorAvatar?: string;

  @Column({ type: 'boolean', default: false })
  tweetAuthorVerified: boolean;

  @Column({ type: 'text' })
  tweetContent: string;

  @Column({ type: 'text', nullable: true })
  tweetContentHtml?: string;

  @Column({ type: 'jsonb', nullable: true })
  tweetMedia?: TweetMedia[];

  @Column({ type: 'timestamp', nullable: true })
  tweetCreatedAt?: Date;

  @Column({ type: 'boolean', default: false })
  isThread: boolean;

  @Column({ type: 'jsonb', nullable: true })
  threadTweets?: TweetData[];

  @Column({ type: 'text' })
  @Index({ unique: true })
  url: string;

  @Column({ type: 'text', nullable: true })
  image?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  summary?: string;
}
