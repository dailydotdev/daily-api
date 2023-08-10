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
  feedbackDimiss: boolean;
}>;

export type UserPostFlagsPublic = Pick<UserPostFlags, 'feedbackDimiss'>;

export enum UserPostVote {
  Up = 1,
  None = 0,
  Down = -1,
}

export const userPostDefaultData = Object.freeze({
  vote: UserPostVote.None,
  hidden: false,
  flags: {},
});

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

  @Column({ type: 'smallint', default: UserPostVote.None })
  vote: UserPostVote;

  @Column({ default: false })
  hidden: boolean;

  @Column({ type: 'jsonb', default: {} })
  flags: UserPostFlags;

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
