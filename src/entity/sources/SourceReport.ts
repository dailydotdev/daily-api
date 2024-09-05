import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import type { User } from '../user';
import { ReportReason } from '../common';

@Entity()
export class SourceReport {
  @PrimaryColumn({ type: 'text' })
  @Index('IDX_source_report_source_id')
  sourceId: string;

  @PrimaryColumn({ length: 36 })
  @Index('IDX_source_report_user_id')
  userId: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'text' })
  reason: ReportReason;

  @Column({ type: 'text', nullable: true })
  comment?: string;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}
