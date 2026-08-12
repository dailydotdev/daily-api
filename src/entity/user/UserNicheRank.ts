import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import type { User } from './User';
import type { Niche } from '../Niche';

/** The two windows a topic is ranked over. */
export enum UserNicheRankPeriod {
  Week = 'week',
  All = 'all',
}

/**
 * One topic's ranking, materialised, one row per (niche, period, reader).
 *
 * Neither period can be ranked live. All time would need
 * `user_niche_analytics` scanned by `nicheId`, which is the reverse of its
 * primary key, plus the eligibility join on every request; a week would need
 * `user_niche_growth`, the largest table in the world feature, aggregated
 * across every reader of the niche before the first row could be returned.
 * Both are per-request costs on a page that is the same for everybody, so both
 * are precomputed once a day instead.
 *
 * Only the top `WORLD_RANK_DEPTH` of each (niche, period) is kept. That is what
 * keeps this small enough to rebuild whole: depth times two periods times the
 * niche catalogue, against the tens of millions of (reader, niche) pairs the
 * uncapped version would hold. It also matches what the ranking can honestly
 * say, past the cap a placing is an artefact of who else happened to open the
 * topic, and the API returns a null rank there, exactly as `leaderboardPosition`
 * does beyond its own cap.
 *
 * The key leads with `nicheId` because every read is "one topic, one period":
 * the listing is a range scan over the index and the viewer's own row is a
 * point lookup.
 */
@Entity()
@Index('IDX_user_niche_rank_listing', ['nicheId', 'period', 'reads'])
export class UserNicheRank {
  @PrimaryColumn({ type: 'uuid' })
  nicheId: string;

  @PrimaryColumn({ type: 'text' })
  period: UserNicheRankPeriod;

  @PrimaryColumn({ type: 'text' })
  userId: string;

  /** Articles read in this niche inside the period. */
  @Column({ type: 'integer' })
  reads: number;

  /**
   * Articles read in this niche over the world's whole life.
   *
   * Carried alongside `reads` so a weekly row can still be shown at its level:
   * a week's reading is a rate and a rate sits on no rung. For the all-time
   * period the two are equal by construction.
   *
   * The count is stored rather than the level. The rungs are a display ladder,
   * and putting them in the materialisation would freeze every row at the
   * thresholds that were current when the cron last ran.
   */
  @Column({ type: 'integer' })
  lifetimeReads: number;

  @ManyToOne('User', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Promise<User>;

  @ManyToOne('Niche', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'nicheId' })
  niche: Promise<Niche>;
}
