import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Claim } from './Claim';

export enum ClaimEvidenceSourceClass {
  Community = 'community',
  VendorChangelog = 'vendor_changelog',
  Registry = 'registry',
  Manual = 'manual',
}

@Entity()
@Index('UQ_claim_evidence_claimId_url', ['claimId', 'url'], { unique: true })
export class ClaimEvidence {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_claim_evidence_id',
  })
  id: string;

  @Column({ type: 'uuid' })
  claimId: string;

  // Soft reference to post.id: evidence survives a post being removed.
  @Column({ type: 'text', nullable: true, default: null })
  postId: string | null;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'text' })
  sourceClass: ClaimEvidenceSourceClass;

  @Column({ type: 'timestamp', nullable: true, default: null })
  publishedAt: Date | null;

  @ManyToOne('Claim', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'claimId',
    foreignKeyConstraintName: 'FK_claim_evidence_claim_id',
  })
  claim: Promise<Claim>;
}
