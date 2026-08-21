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

export type InterestFeedbackRelationship = {
  id: string;
  entity: 'post';
  entityId: string;
  url: string | null;
  title: string | null;
  summary: string | null;
};

@Entity()
@Index('IDX_interest_feedback_interest_id_created', ['interestId', 'createdAt'])
export class InterestFeedback {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ type: 'text' })
  interestId: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'timestamptz', nullable: true })
  appliedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  relationships: InterestFeedbackRelationship[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne('UserInterest', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'interestId' })
  interest: Promise<UserInterest>;
}
