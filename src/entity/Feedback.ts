import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from './user';

export type FeedbackClassification = {
  platform?: string;
  category?: string;
  sentiment?: string;
  urgency?: string;
};

export type FeedbackFlags = Partial<{
  vordr: boolean;
}>;

@Entity()
export class Feedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_feedback_user_id')
  @Column({ length: 36 })
  userId: string;

  @Column({ type: 'text' })
  category: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  pageUrl: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ type: 'jsonb', nullable: true })
  classification: FeedbackClassification | null;

  @Column({ type: 'text', nullable: true })
  linearIssueId: string | null;

  @Column({ type: 'text', nullable: true })
  linearIssueUrl: string | null;

  @Column({ type: 'text', default: 'pending' })
  @Index('IDX_feedback_status')
  status: string;

  @Column({ type: 'jsonb', default: {} })
  flags: FeedbackFlags;

  @CreateDateColumn()
  @Index('IDX_feedback_created_at')
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}
