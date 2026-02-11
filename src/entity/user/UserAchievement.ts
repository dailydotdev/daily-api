import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from './User';
import type { Achievement } from '../Achievement';

@Entity()
@Index('IDX_user_achievement_userId', ['userId'])
@Index('IDX_user_achievement_unlockedAt', ['unlockedAt'])
@Index('IDX_user_achievement_userId_unlockedAt', ['userId', 'unlockedAt'])
export class UserAchievement {
  @PrimaryColumn({
    type: 'uuid',
    primaryKeyConstraintName: 'PK_user_achievement',
  })
  achievementId: string;

  @PrimaryColumn({
    length: 36,
    primaryKeyConstraintName: 'PK_user_achievement',
  })
  userId: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'integer', default: 0 })
  progress: number;

  @Column({ type: 'timestamp', nullable: true })
  unlockedAt: Date | null;

  @ManyToOne('Achievement', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'achievementId',
    foreignKeyConstraintName: 'FK_user_achievement_achievement_id',
  })
  achievement: Promise<Achievement>;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_user_achievement_user_id',
  })
  user: Promise<User>;
}
