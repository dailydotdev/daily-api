import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Quest } from './Quest';

export enum QuestRewardType {
  XP = 'xp',
  Reputation = 'reputation',
  Cores = 'cores',
}

@Entity()
@Index('IDX_quest_reward_questId', ['questId'])
@Index('UQ_quest_reward_questId_type', ['questId', 'type'], { unique: true })
export class QuestReward {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_quest_reward_id',
  })
  id: string;

  @Column({ type: 'uuid' })
  questId: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'text' })
  type: QuestRewardType;

  @Column({ type: 'integer' })
  amount: number;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @ManyToOne('Quest', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'questId',
    foreignKeyConstraintName: 'FK_quest_reward_quest_id',
  })
  quest: Promise<Quest>;
}
