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
import type { User } from './User';
import type { Niche } from '../Niche';

/**
 * One row per (user, niche) — a district in the user's personal world.
 *
 * A running sum, never recomputed: the delta cron adds to it. `reads` counts
 * distinct posts, deduplicated within each cron run rather than over all time, so
 * strictly it is "posts per day you engaged with them" (+5.08% against true
 * lifetime-distinct). Exact dedup would need a 71M-row (userId, postId) ledger.
 *
 * The primary key is (userId, nicheId) IN THAT ORDER. Rendering a world reads
 * 4-40 rows for one user, so a userId-leading key makes it a single range scan;
 * reversed it would be up to 40 point lookups. This is the one place the shape
 * differs from PostAnalytics, which is genuinely a point lookup by post.
 */
@Entity()
@Index('IDX_user_niche_analytics_updatedAt', ['updatedAt'])
export class UserNicheAnalytics {
  @PrimaryColumn({ type: 'text' })
  userId: string;

  @PrimaryColumn({ type: 'uuid' })
  nicheId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /** Distinct posts read in this niche. Drives the building's level. */
  @Column({ type: 'integer', default: 0 })
  reads: number;

  /** Founding date — when this district first appeared in the world. */
  @Column({ type: 'date' })
  firstReadAt: string;

  /** Most recent read; drives the "currently lit" dressing. */
  @Column({ type: 'date' })
  lastReadAt: string;

  /** Distinct days on which this district gained reads. */
  @Column({ type: 'integer', default: 0 })
  activeDays: number;

  @ManyToOne('User', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Promise<User>;

  @ManyToOne('Niche', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'nicheId' })
  niche: Promise<Niche>;
}
