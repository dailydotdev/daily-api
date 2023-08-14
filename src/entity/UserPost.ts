import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Post } from './posts';
import { User } from './User';

export type UserPostFlags = Partial<{
  feedbackDismiss: boolean;
}>;

export type UserPostFlagsPublic = Pick<UserPostFlags, 'feedbackDismiss'>;

export enum UserPostVote {
  Up = 1,
  None = 0,
  Down = -1,
}

@Entity()
@Index(['postId', 'userId'], { unique: true })
export class UserPost {
  @PrimaryColumn({ type: 'text' })
  postId: string;

  @PrimaryColumn({ type: 'text' })
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ default: null, nullable: true })
  votedAt: Date;

  @Column({ type: 'smallint', default: UserPostVote.None })
  vote: UserPostVote = UserPostVote.None;

  @Column({ type: 'boolean', default: false })
  hidden = false;

  @Column({ type: 'jsonb', default: {} })
  flags: UserPostFlags = {};

  @ManyToOne(() => Post, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  post: Promise<Post>;

  @ManyToOne(() => User, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}
