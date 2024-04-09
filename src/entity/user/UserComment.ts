import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './User';
import { Comment } from '../Comment';
import { UserVote } from '../../types';

export type UserCommentFlags = Partial<{
  // flags
}>;

@Entity()
@Index(['commentId', 'userId'], { unique: true })
@Index(['userId', 'vote', 'votedAt'])
export class UserComment {
  @PrimaryColumn({ type: 'text' })
  commentId: string;

  @PrimaryColumn({ type: 'text' })
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ default: null, nullable: true })
  votedAt: Date;

  @Column({ type: 'smallint', default: UserVote.None })
  vote: UserVote = UserVote.None;

  @Column({ type: 'jsonb', default: {} })
  flags: UserCommentFlags = {};

  @ManyToOne(() => Comment, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  comment: Promise<Comment>;

  @ManyToOne(() => User, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}
