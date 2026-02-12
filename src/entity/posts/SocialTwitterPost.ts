import { ChildEntity, Column, ManyToOne } from 'typeorm';
import { Post, PostType } from './Post';

@ChildEntity(PostType.SocialTwitter)
export class SocialTwitterPost extends Post {
  @Column({ nullable: true })
  publishedAt?: Date;

  @Column({ type: 'text', nullable: true })
  url: string | null;

  @Column({ type: 'text', nullable: true })
  canonicalUrl?: string;

  @Column({ type: 'text', nullable: true })
  image?: string;

  @Column({ type: 'text', nullable: true })
  content?: string;

  @Column({ type: 'text', nullable: true })
  contentHtml?: string;

  @Column({ type: 'text', nullable: true })
  siteTwitter?: string;

  @Column({ type: 'text', nullable: true })
  creatorTwitter?: string;

  @Column({ type: 'text', nullable: true })
  videoId?: string;

  @Column({ type: 'text', nullable: true })
  sharedPostId?: string;

  @ManyToOne(() => Post, { lazy: true, onDelete: 'SET NULL' })
  sharedPost?: Promise<Post>;
}
