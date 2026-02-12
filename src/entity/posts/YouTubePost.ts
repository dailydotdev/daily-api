import { ChildEntity, Column, Index } from 'typeorm';
import { Post, PostType } from './Post';

@ChildEntity(PostType.VideoYouTube)
export class YouTubePost extends Post {
  @Column({ nullable: true })
  publishedAt?: Date;

  @Column({ type: 'text', nullable: true })
  image?: string;

  @Column({ type: 'text' })
  @Index({ unique: true })
  url: string;

  @Column({ type: 'text', nullable: true })
  @Index({ unique: true })
  canonicalUrl?: string;

  @Column({ type: 'text' })
  videoId: string;
}
