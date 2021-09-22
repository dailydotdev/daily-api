import { Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import BaseUpvote from './BaseUpvote';
import { Post } from './Post';

@Entity()
export class Upvote extends BaseUpvote {
  @PrimaryColumn({ type: 'text' })
  @Index()
  postId: string;

  @ManyToOne(() => Post, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  post: Promise<Post>;
}
