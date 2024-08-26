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
  image?: string;

  @Column({ type: 'float', nullable: true })
  ratio?: number;

  @Column({ type: 'text', nullable: true })
  placeholder?: string;

  @Column({ type: 'text', nullable: true })
  siteTwitter?: string;

  @Column({ type: 'text', nullable: true })
  creatorTwitter?: string;

  @Column({ nullable: true })
  readTime?: number;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'jsonb', nullable: true })
  toc?: Toc;

  @Column({ type: 'text', nullable: true })
  summary?: string;
}
