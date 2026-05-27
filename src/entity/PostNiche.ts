import {
  Column,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Mapping table from a post to its derived niches.
 *
 * One post → 1 or 2 rows (rank=1 primary, rank=2 secondary). Niches are
 * derived from the post's tags via weighted vote against `keyword_niche`
 * (see docs/feed-niche-taxonomy.md). The diversifier reads this table to
 * penalize repetition along niche axes at re-ranking time.
 *
 *  - rank=1   primary niche (always present for posts with any labeled tag;
 *             posts with no labeled tags fall back to the `other` niche)
 *  - rank=2   secondary niche (optional)
 *  - score    raw derivation score for the assigned niche (debug/audit)
 *  - computedAt   when derivation last ran for this row
 */
@Entity()
@Index('IDX_post_niche_niche_rank', ['nicheId', 'rank'])
export class PostNiche {
  @PrimaryColumn({ type: 'text' })
  postId: string;

  @PrimaryColumn({ type: 'uuid' })
  nicheId: string;

  @Column({ type: 'smallint' })
  rank: number;

  @Column({ type: 'real', nullable: true })
  score?: number | null;

  @Column({ default: () => 'now()' })
  computedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
