import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import type { User } from './User';

/** One entry of a summary's top districts. */
export type UserWorldSummaryTopNiche = {
  nicheId: string;
  reads: number;
};

/**
 * One row per world that is worth listing anywhere, rebuilt by the
 * `world-index` cron.
 *
 * Two jobs. It is the ELIGIBILITY set, a row exists only for a world that is
 * public and has cleared `WORLD_INDEX_MIN_DISTRICTS`, so every listing on the
 * index joins it rather than re-deriving who may be shown. And it carries the
 * four numbers every card on the page needs (name comes off the settings row),
 * which would otherwise be an aggregate over the whole of
 * `user_niche_analytics` per world rendered.
 *
 * Being absent is the safe direction and being present is not, so privacy is
 * NOT delegated to this table: a world made private after the last rebuild
 * still has a row here for up to a day. Every read path anti-joins
 * `user_world_settings` live on top of this (see `applyWorldIndexPrivacy`).
 * Filtering at build time as well keeps the table small and makes the two
 * checks independent, a bug in either one alone cannot leak a world.
 *
 * The reverse lag is accepted: a world turned public, or a district that just
 * cleared the floor, waits for the next rebuild.
 */
@Entity()
@Index('IDX_user_world_summary_reads', ['reads'])
export class UserWorldSummary {
  @PrimaryColumn({ type: 'text' })
  userId: string;

  /** Districts the world holds, after serving-hidden niches are dropped. */
  @Column({ type: 'integer' })
  districts: number;

  /** Articles read across every district. */
  @Column({ type: 'integer' })
  reads: number;

  /**
   * The largest districts, biggest first, capped at
   * `WORLD_INDEX_TOP_NICHES`.
   *
   * Stored as ids rather than slugs or titles: a niche can be retitled, and a
   * denormalised copy of the title would then be wrong until the next rebuild.
   */
  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` })
  topNiches: UserWorldSummaryTopNiche[];

  @OneToOne('User', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Promise<User>;
}
