import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from './User';
import type { QuestRotation } from '../QuestRotation';

export enum UserQuestStatus {
  InProgress = 'in_progress',
  Completed = 'completed',
  Claimed = 'claimed',
}

@Entity()
@Index('IDX_user_quest_userId_status', ['userId', 'status'])
@Index('UQ_user_quest_user_rotation', ['rotationId', 'userId'], {
  unique: true,
})
export class UserQuest {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_user_quest_id',
  })
  id: string;

  @Column({ type: 'uuid' })
  rotationId: string;

  @Column({
    length: 36,
  })
  userId: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'integer', default: 0 })
  progress: number;

  @Column({ type: 'text', default: UserQuestStatus.InProgress })
  status: UserQuestStatus;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  claimedAt: Date | null;

  @ManyToOne('QuestRotation', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'rotationId',
    foreignKeyConstraintName: 'FK_user_quest_rotation_id',
  })
  rotation: Promise<QuestRotation>;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_user_quest_user_id',
  })
  user: Promise<User>;
}
