import { Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { Post } from './posts';

@Entity()
export class HiddenPost {
  @PrimaryColumn({ type: 'text' })
  @Index()
  postId: string;

  @PrimaryColumn({ type: 'text' })
  @Index()
  userId: string;

  @ManyToOne(() => Post, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  post: Promise<Post>;
}
