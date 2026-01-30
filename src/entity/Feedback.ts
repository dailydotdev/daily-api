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
import { UserFeedbackCategory } from '@dailydotdev/schema';

export enum FeedbackStatus {
  Pending = 0,
  Processing = 1,
  Completed = 2,
  Failed = 3,
  Spam = 4,
}

export type FeedbackClassification = {
  sentiment?: string;
  urgency?: string;
  tags?: string[];
  summary?: string;
  hasPromptInjection?: boolean;
  suggestedTeam?: string;
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

  @Column({
    type: 'integer',
    comment: 'UserFeedbackCategory from protobuf schema',
  })
  category: UserFeedbackCategory;

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

  @Column({
    type: 'integer',
    default: FeedbackStatus.Pending,
    comment: 'FeedbackStatus enum internal',
  })
  @Index('IDX_feedback_status')
  status: FeedbackStatus;

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
