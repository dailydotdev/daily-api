import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Feedback } from './Feedback';

@Entity()
export class FeedbackReply {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index('IDX_feedback_reply_feedback_id')
  feedbackId: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'text', nullable: true })
  authorName: string | null;

  @Column({ type: 'text', nullable: true })
  authorEmail: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne('Feedback', { onDelete: 'CASCADE' })
  feedback: Promise<Feedback>;
}
