import { ChildEntity, Column, Index } from 'typeorm';
import { Post, PostType } from './Post';

export type TocItem = { text: string; id?: string; children?: TocItem[] };
export type Toc = TocItem[];

@ChildEntity(PostType.Article)
export class ArticlePost extends Post {
  @Column({ nullable: true })
  publishedAt?: Date;

  @Column({ type: 'text', nullable: true })
  @Index({ unique: true })
  url: string | null;

  @Column({ type: 'text', nullable: true })
  @Index({ unique: true })
  canonicalUrl?: string;

  @Column({ type: 'text', nullable: true })
  image?: string | null;

  @Column({ type: 'text', nullable: true })
  siteTwitter?: string;

  @Column({ type: 'text', nullable: true })
  creatorTwitter?: string;

  @Column({ type: 'jsonb', nullable: true })
  toc?: Toc;
}
