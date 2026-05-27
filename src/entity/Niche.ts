import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export enum NicheBucketGroup {
  Ecosystem = 'ecosystem',
  Theme = 'theme',
}

/**
 * Catalog of post niches used by the feed diversifier.
 *
 * A niche represents the mental category a user uses when saying
 * "stop showing me X" — the unit at which feed diversification penalizes
 * repetition. Niches split into two groups:
 *  - ecosystem  — stack identity (e.g. js_ts, rust, python)
 *  - theme      — cross-stack topics (e.g. ai_llm, sec_threats, cloud)
 */
@Entity()
export class Niche {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ type: 'text' })
  title: string;

  @Column({
    type: 'text',
    default: NicheBucketGroup.Theme,
  })
  bucketGroup: NicheBucketGroup;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
