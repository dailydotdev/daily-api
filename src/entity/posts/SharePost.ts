import { ChildEntity, Column, Index, OneToOne } from 'typeorm';
import { Post, PostType } from './Post';

@ChildEntity(PostType.Share)
export class SharePost extends Post {
  @Column({ type: 'text' })
  @Index('IDX_sharedPostId')
  sharedPostId: string;

  @OneToOne(() => Post, { lazy: true, onDelete: 'SET NULL' })
  sharedPost: Promise<Post>;
}

export const MAX_COMMENTARY_LENGTH = 5000;
