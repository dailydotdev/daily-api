import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Claim, ClaimChangeType } from './Claim';
import type { LedgerEntityKind } from './LedgerEntity';

export enum ClaimDirectness {
  Announcement = 'announcement',
  Report = 'report',
  Firsthand = 'firsthand',
}

export enum ClaimCandidateStatus {
  Pending = 'pending',
  Merged = 'merged',
  Denied = 'denied',
}

@Entity()
@Index('IDX_claim_candidate_status', ['status'])
@Index('IDX_claim_candidate_postId', ['postId'])
export class ClaimCandidate {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_claim_candidate_id',
  })
  id: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'text' })
  postId: string;

  @Column({ type: 'text' })
  rawEntityName: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  entityAliases: string[];

  @Column({ type: 'text' })
  entityKind: LedgerEntityKind;

  @Column({ type: 'text' })
  changeType: ClaimChangeType;

  @Column({ type: 'text' })
  statement: string;

  @Column({ type: 'text', nullable: true, default: null })
  versionScope: string | null;

  @Column({ type: 'date', nullable: true, default: null })
  effectiveDate: string | null;

  @Column({ type: 'date', nullable: true, default: null })
  sunsetDate: string | null;

  @Column({ type: 'text', nullable: true, default: null })
  supersededBy: string | null;

  @Column({ type: 'text' })
  directness: ClaimDirectness;

  @Column({ type: 'text' })
  evidence: string;

  @Column({ type: 'text', default: ClaimCandidateStatus.Pending })
  status: ClaimCandidateStatus;

  @Column({ type: 'uuid', nullable: true, default: null })
  claimId: string | null;

  @ManyToOne('Claim', { lazy: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'claimId',
    foreignKeyConstraintName: 'FK_claim_candidate_claim_id',
  })
  claim: Promise<Claim | null>;
}
