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
 * One row per (user, day, niche) — the growth log.
 *
 * This table does double duty. It is the timeline (replaying it in date order is
 * the world being built), and it is also the delta ledger: the cron writes here
 * first, and `ON CONFLICT DO NOTHING` on the composite key is what makes a rerun of
 * the same window a no-op. `UserNicheAnalytics` is then advanced from the rows that
 * were actually inserted.
 *
 * Because of that, phases 1 and 2 ship together — the timeline is not extra work,
 * it is the mechanism.
 *
 * Key order matches UserNicheAnalytics: userId leads so a user's whole history is
 * one range scan.
 *
 * The lone index on `date` is for the reverse question, a window across every
 * reader, which is what the world index's weekly ranking is built from.
 */
@Entity()
@Index('IDX_user_niche_growth_date', ['date'])
export class UserNicheGrowth {
  @PrimaryColumn({ type: 'text' })
  userId: string;

  @PrimaryColumn({ type: 'date' })
  date: string;

  @PrimaryColumn({ type: 'uuid' })
  nicheId: string;

  /** Distinct posts first read in this niche on this day. */
  @Column({ type: 'integer' })
  reads: number;

  @ManyToOne('User', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Promise<User>;

  @ManyToOne('Niche', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'nicheId' })
  niche: Promise<Niche>;
}
