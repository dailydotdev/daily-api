import { Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import type { Post } from './posts';

@Entity()
export class PostTag {
  @PrimaryColumn({ type: 'text' })
  @Index()
  postId: string;

  @PrimaryColumn({ type: 'text' })
  tag: string;

  @ManyToOne('Post', (post: Post) => post.tags, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  post: Promise<Post>;
}
