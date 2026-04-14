import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from './User';

@Entity()
export class UserQuestProfile {
  @PrimaryColumn({
    length: 36,
    primaryKeyConstraintName: 'PK_user_quest_profile',
  })
  userId: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'integer', default: 0 })
  totalXp: number;

  @Column({ type: 'timestamp', nullable: true })
  lastViewedQuestRotationsAt: Date | null;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_user_quest_profile_user_id',
  })
  user: Promise<User>;
}
