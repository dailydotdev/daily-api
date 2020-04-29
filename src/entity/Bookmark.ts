import {
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Post } from './Post';

@Entity()
@Index(['userId', 'createdAt'])
export class Bookmark {
  @PrimaryColumn({ type: 'text' })
  @Index()
  postId: string;

  @PrimaryColumn({ type: 'text' })
  @Index()
  userId: string;

  @ManyToOne(() => Post, (post) => post.tags, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  post: Promise<Post>;

  @CreateDateColumn()
  createdAt: Date;
}
