import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import type { User } from './User';
import type { UserHotTake } from './UserHotTake';

@Entity()
@Index(['hotTakeId', 'userId'], { unique: true })
@Index(['userId', 'createdAt'])
@Index(['hotTakeId', 'createdAt'])
export class UserHotTakeUpvote {
  @PrimaryColumn({ type: 'uuid' })
  hotTakeId: string;

  @PrimaryColumn({ type: 'text' })
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne('UserHotTake', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'hotTakeId',
    foreignKeyConstraintName: 'FK_user_hot_take_upvote_hot_take_id',
  })
  hotTake: Promise<UserHotTake>;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_user_hot_take_upvote_user_id',
  })
  user: Promise<User>;
}
