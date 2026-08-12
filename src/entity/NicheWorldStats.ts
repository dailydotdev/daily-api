import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import type { Niche } from './Niche';

/**
 * How many listable worlds have read a niche at all, rebuilt by the
 * `world-index` cron.
 *
 * Separate from `user_niche_rank` because it counts the whole population and
 * that table only keeps the top of it, the readers past the depth cap still
 * have to be counted, they just cannot be ranked. Live it is a `COUNT(*)` over
 * every district in the niche joined to the eligibility set, per topic the page
 * shows.
 */
@Entity()
export class NicheWorldStats {
  @PrimaryColumn({ type: 'uuid' })
  nicheId: string;

  /** Listable worlds holding a district in this niche. */
  @Column({ type: 'integer' })
  readers: number;

  @OneToOne('Niche', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'nicheId' })
  niche: Promise<Niche>;
}
