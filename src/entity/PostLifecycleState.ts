import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Post } from './posts/Post';
import type { PostLifecycleStateValue } from '../common/postLifecycleState';

@Entity()
@Index('UQ_post_lifecycle_state_post', ['postId'], { unique: true })
export class PostLifecycleState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  postId: string;

  @Column({ type: 'text' })
  state: PostLifecycleStateValue;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne('Post', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  post: Promise<Post>;
}
