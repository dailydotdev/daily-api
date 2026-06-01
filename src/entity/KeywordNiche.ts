import {
  Column,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Mapping from a keyword (tag) to its niche assignment(s).
 *
 * Each tag maps to a single primary niche and optionally a secondary niche.
 * The diversifier derives a post's niches from the niches of its tags via
 * weighted vote (see docs/feed-niche-taxonomy.md for the derivation rules).
 *
 *  - weightMultiplier  per-tag dampening factor (e.g. 0.3 for very generic
 *                     tags like "programming"), default 1.0
 *  - confidence       1=guess, 2=likely, 3=clear — used to prioritize audits
 *  - labelerVersion   identifier of the labeler/taxonomy version that
 *                     produced this row, so we can re-label deltas later
 */
@Entity()
export class KeywordNiche {
  @PrimaryColumn({ type: 'text' })
  keyword: string;

  @Column({ type: 'uuid' })
  @Index('IDX_keyword_niche_primary')
  primaryNicheId: string;

  @Column({ type: 'uuid', nullable: true })
  @Index('IDX_keyword_niche_secondary')
  secondaryNicheId?: string | null;

  @Column({ type: 'real', default: 1 })
  weightMultiplier: number;

  @Column({ type: 'smallint', default: 2 })
  confidence: number;

  @Column({ type: 'text', nullable: true })
  labelerVersion?: string | null;

  @Column({ default: () => 'now()' })
  labeledAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
