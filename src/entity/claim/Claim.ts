import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { LedgerEntity } from './LedgerEntity';

export enum ClaimChangeType {
  Breaking = 'breaking',
  Deprecation = 'deprecation',
  Removal = 'removal',
  Release = 'release',
  NewCapability = 'new_capability',
  Displacement = 'displacement',
  ConsensusShift = 'consensus_shift',
  Gotcha = 'gotcha',
  Security = 'security',
  Fix = 'fix',
  Pricing = 'pricing',
}

export enum ClaimStatus {
  Candidate = 'candidate',
  Corroborated = 'corroborated',
  Verified = 'verified',
  Rejected = 'rejected',
}

@Entity()
@Index('IDX_claim_entityId_effectiveDate', ['entityId', 'effectiveDate'])
export class Claim {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_claim_id',
  })
  id: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'uuid' })
  entityId: string;

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

  @Column({ type: 'uuid', nullable: true, default: null })
  supersededByEntityId: string | null;

  // An announce-then-reverse pair leaves both claims true of their own moment,
  // so the reversed one is linked to its successor instead of being rejected.
  @Column({ type: 'uuid', nullable: true, default: null })
  supersededByClaimId: string | null;

  @Column({ type: 'text', default: ClaimStatus.Candidate })
  status: ClaimStatus;

  @ManyToOne('LedgerEntity', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'entityId',
    foreignKeyConstraintName: 'FK_claim_entity_id',
  })
  entity: Promise<LedgerEntity>;

  @ManyToOne('LedgerEntity', {
    lazy: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'supersededByEntityId',
    foreignKeyConstraintName: 'FK_claim_superseded_by_entity_id',
  })
  supersededByEntity: Promise<LedgerEntity | null>;

  @ManyToOne('Claim', { lazy: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'supersededByClaimId',
    foreignKeyConstraintName: 'FK_claim_superseded_by_claim_id',
  })
  supersededByClaim: Promise<Claim | null>;
}
