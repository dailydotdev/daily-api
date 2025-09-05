import { ChildEntity, Column, Index, ManyToOne } from 'typeorm';
import { Post, PostType } from './Post';
import { ArticlePost } from './ArticlePost';
import { FreeformPost } from './FreeformPost';

@ChildEntity(PostType.Share)
export class SharePost extends Post {
  @Column({ type: 'text' })
  @Index('IDX_sharedPostId')
  sharedPostId: string;

  @ManyToOne(() => Post, { lazy: true, onDelete: 'SET NULL' })
  sharedPost: Promise<ArticlePost | FreeformPost>;
}

export const MAX_COMMENTARY_LENGTH = 5000;
