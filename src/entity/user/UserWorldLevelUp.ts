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

/**
 * A district that crossed a rung, kept so the index can show it.
 *
 * Written by the `user-world-clickhouse` cron, which already computes every
 * crossing in the run it applies, it holds both the reads before and the reads
 * after for each district it touches, so this is a write and nothing else. The
 * alternative, deriving crossings on the way out, means re-deriving "what did
 * this district hold yesterday" from the growth log for every reader who read
 * anything, and doing it against thresholds that may have moved since.
 *
 * Rows are kept for `WORLD_LEVEL_UP_RETENTION_DAYS` and swept by the
 * `world-index` cron; the index only ever asks for about a day.
 *
 * The key is (userId, nicheId, level): a district reaches a given rung once, so
 * a re-run of the same window cannot double-list it, and a district that
 * somehow arrives at a rung twice keeps the first crossing rather than
 * refreshing its date.
 */
@Entity()
@Index('IDX_user_world_level_up_createdAt', ['createdAt'])
export class UserWorldLevelUp {
  @PrimaryColumn({ type: 'text' })
  userId: string;

  @PrimaryColumn({ type: 'uuid' })
  nicheId: string;

  /** The rung reached, on the twelve-step district ladder. */
  @PrimaryColumn({ type: 'integer' })
  level: number;

  /** Articles the district held when it crossed. */
  @Column({ type: 'integer' })
  reads: number;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @ManyToOne('User', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Promise<User>;

  @ManyToOne('Niche', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'nicheId' })
  niche: Promise<Niche>;
}
