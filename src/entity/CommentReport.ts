import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import type { User } from './user';
import { ReportReason } from './common';

@Entity()
export class CommentReport {
  @PrimaryColumn({ type: 'text' })
  commentId: string;

  @PrimaryColumn({ length: 36 })
  @Index('IDX_comment_report_user_id')
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
