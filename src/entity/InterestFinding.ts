import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { UserInterest } from './UserInterest';
import type { Post } from './posts';

export enum InterestFindingStatus {
  New = 'new',
  Surfaced = 'surfaced',
  Dismissed = 'dismissed',
}

@Entity()
@Index('IDX_interest_finding_interest_id_post_id', ['interestId', 'postId'], {
  unique: true,
})
@Index('IDX_interest_finding_interest_id_score', ['interestId', 'score'])
export class InterestFinding {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ type: 'text' })
  interestId: string;

  @Column({ type: 'text' })
  postId: string;

  @Column({ type: 'double precision', default: 0 })
  score: number;

  @Column({ type: 'text', nullable: true })
  rationale: string | null;

  @Column({ type: 'text', default: InterestFindingStatus.New })
  status: InterestFindingStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne('UserInterest', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'interestId' })
  interest: Promise<UserInterest>;

  @ManyToOne('Post', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post: Promise<Post>;
}
