import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import type { UserInterest } from './UserInterest';
import type { InterestFeedback } from './InterestFeedback';

export enum InterestRunStatus {
  Queued = 'queued',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
}

export enum InterestRunTrigger {
  Spawn = 'spawn',
  Command = 'command',
  Scheduled = 'scheduled',
}

export type InterestRunBlock =
  | { type: 'text'; html: string }
  | { type: 'picks'; caption?: string; postIds: string[] }
  | { type: 'feedLink'; label: string; count: number };

@Entity()
@Index('IDX_interest_run_interest_id_created', ['interestId', 'createdAt'])
@Index('IDX_interest_run_interest_id_running', ['interestId'], {
  unique: true,
  where: `status = 'running'`,
})
export class InterestRun {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ type: 'text' })
  interestId: string;

  @Column({ type: 'text', default: InterestRunStatus.Queued })
  status: InterestRunStatus;

  @Column({ type: 'text', default: InterestRunTrigger.Scheduled })
  trigger: InterestRunTrigger;

  @Column({ type: 'text', nullable: true })
  feedbackId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  blocks: InterestRunBlock[] | null;

  @Column({ type: 'integer', default: 0 })
  findingsAdded: number;

  @Column({ type: 'text', nullable: true })
  summaryPostId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne('UserInterest', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'interestId' })
  interest: Promise<UserInterest>;

  @ManyToOne('InterestFeedback', { lazy: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'feedbackId' })
  feedback: Promise<InterestFeedback>;
}
