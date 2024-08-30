import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import type { User } from '../user';

enum SourceReportReason {
  Explicit = 'EXPLICIT',
  Spam = 'SPAM',
  Hateful = 'HATEFUL',
  Copyright = 'COPYRIGHT',
  Privacy = 'PRIVACY',
  Miscategorized = 'MISCATEGORIZED',
  Illegal = 'ILLEGAL',
}

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

  @Column({ length: 12 })
  reason: SourceReportReason;

  @Column({ type: 'text', nullable: true })
  comment?: string;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}
