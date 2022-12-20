import { ChildEntity, Column, OneToOne } from 'typeorm';
import { Post } from './Post';

@ChildEntity('share')
export class SharePost extends Post {
  @Column({ type: 'text' })
  sharedPostId: string;

  @OneToOne(() => Post, { lazy: true, onDelete: 'SET NULL' })
  sharedPost: Promise<Post>;
}
