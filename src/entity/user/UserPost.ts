import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Post } from '../posts';
import { User } from './User';
import { UserVote } from '../../common/vote';

export type UserPostFlags = Partial<{
  feedbackDismiss: boolean;
}>;

export type UserPostFlagsPublic = Pick<UserPostFlags, 'feedbackDismiss'>;

@Entity()
@Index(['postId', 'userId'], { unique: true })
@Index(['userId', 'vote', 'votedAt'])
@Index('IDX_user_post_postid_userid_hidden', ['postId', 'userId', 'hidden'])
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

  @Column({ type: 'smallint', default: UserVote.None })
  vote: UserVote = UserVote.None;

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
