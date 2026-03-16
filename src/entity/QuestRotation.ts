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
import { QuestType } from './Quest';

@Entity()
@Index('IDX_quest_rotation_type_period', ['type', 'periodStart', 'periodEnd'])
@Index(
  'UQ_quest_rotation_slot_period',
  ['type', 'plusOnly', 'slot', 'periodStart'],
  {
    unique: true,
  },
)
@Index('UQ_quest_rotation_quest_period', ['questId', 'periodStart'], {
  unique: true,
})
export class QuestRotation {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_quest_rotation_id',
  })
  id: string;

  @Column({ type: 'uuid' })
  questId: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'text' })
  type: QuestType;

  @Column({ type: 'boolean', default: false })
  plusOnly: boolean;

  @Column({ type: 'smallint' })
  slot: number;

  @Column({ type: 'timestamp' })
  periodStart: Date;

  @Column({ type: 'timestamp' })
  periodEnd: Date;

  @ManyToOne('Quest', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'questId',
    foreignKeyConstraintName: 'FK_quest_rotation_quest_id',
  })
  quest: Promise<Quest>;
}
