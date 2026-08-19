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

// A claim the extractor dated itself is the only one safe to slice into a
// month window; the rest carry the date of what reported them, which is an
// upper bound on when the change actually landed.
export enum ClaimDateSource {
  Extracted = 'extracted',
  EvidencePublished = 'evidence_published',
  EvidenceCrawled = 'evidence_crawled',
}

export enum ClaimStatus {
  Candidate = 'candidate',
  Corroborated = 'corroborated',
  Verified = 'verified',
  Rejected = 'rejected',
}

@Entity()
@Index('IDX_claim_entityId_effectiveDate', ['entityId', 'effectiveDate'])
@Index('IDX_claim_changeType_effectiveDate', ['changeType', 'effectiveDate'])
@Index('IDX_claim_supersededByClaimId', ['supersededByClaimId'])
@Index('IDX_claim_supersededByEntityId', ['supersededByEntityId'])
// GIN indexes over the signature arrays, created in the migration since
// TypeORM cannot express the index method.
@Index('IDX_claim_affected', { synchronize: false })
@Index('IDX_claim_superseding', { synchronize: false })
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

  // Semver, calver and bare-integer versions are all dot-separated numeric
  // tuples, and postgres compares int[] element-wise, so one derived column
  // orders every scheme the corpus actually uses. Release channels ("beta",
  // "public preview") carry no number and stay null.
  @Column({
    type: 'int',
    array: true,
    nullable: true,
    generatedType: 'STORED',
    asExpression: `string_to_array((regexp_match("versionScope", '([0-9]+(?:\\.[0-9]+)*)'))[1], '.')::int[]`,
    insert: false,
    update: false,
  })
  versionParsed: number[] | null;

  // What this change makes stale: symbols, import paths, model IDs, endpoints.
  // Kept apart from the entity's aliases because aliases answer which thing a
  // claim is about, and these answer which part of it the change touched.
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  affected: string[];

  // What replaces them. A plan reaching for one of these made the current
  // choice, so matching it here is the opposite of a finding.
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  superseding: string[];

  @Column({ type: 'date', nullable: true, default: null })
  effectiveDate: string | null;

  @Column({ type: 'date', nullable: true, default: null })
  sunsetDate: string | null;

  @Column({ type: 'text', nullable: true, default: null })
  dateSource: ClaimDateSource | null;

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
