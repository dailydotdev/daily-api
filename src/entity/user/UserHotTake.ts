import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from './User';
import type { HotTake } from './HotTake';
import { UserVote } from '../../types';

@Entity()
@Index(['hotTakeId', 'userId'], { unique: true })
@Index(['userId', 'vote', 'votedAt'])
export class UserHotTake {
  @PrimaryColumn({ type: 'uuid' })
  hotTakeId: string;

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

  @ManyToOne('HotTake', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'hotTakeId',
    foreignKeyConstraintName: 'FK_user_hot_take_hot_take_id',
  })
  hotTake: Promise<HotTake>;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_user_hot_take_user_id',
  })
  user: Promise<User>;
}
