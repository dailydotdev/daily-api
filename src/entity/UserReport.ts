import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { User } from './user';
import { ReportReason } from './common';

@Entity()
export class UserReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  @Index('IDX_user_report_reported_user_id')
  reportedUserId: string;

  @Column({ type: 'text' })
  userId: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ length: 36, type: 'varchar' })
  reason: ReportReason;

  @Column({ type: 'text', nullable: true })
  note: string;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}
