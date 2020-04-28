import { Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { Post } from './Post';

@Entity()
export class PostTag {
  @PrimaryColumn({ type: 'text' })
  @Index()
  postId: string;

  @PrimaryColumn({ type: 'text' })
  tag: string;

  @ManyToOne(() => Post, (post) => post.tags, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  post: Promise<Post>;
}
