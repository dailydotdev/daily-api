import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum NicheBucketGroup {
  Ecosystem = 'ecosystem',
  Theme = 'theme',
}

/**
 * The six groups a niche belongs to, as the world's taxonomy draws them.
 *
 * Coarser than `bucketGroup`, and for a different job: bucket group tells the
 * feed diversifier how to spread a feed, a domain is what a reader recognises
 * as a field they read in. The ids are the realm ids in the renderer's
 * `engine/taxonomy.js`, so the two stay traceable to each other.
 */
export enum NicheDomain {
  AiData = 'swarm',
  WebMobile = 'frame',
  Systems = 'forge',
  CloudInfra = 'ship',
  Security = 'bastion',
  CraftCareer = 'quarter',
}

/**
 * Catalog of post niches used by the feed diversifier.
 *
 * A niche represents the mental category a user uses when saying
 * "stop showing me X" — the unit at which feed diversification penalizes
 * repetition. Niches split into two groups:
 *  - ecosystem  — stack identity (e.g. js_ts, rust, python)
 *  - theme      — cross-stack topics (e.g. ai_llm, sec_threats, cloud)
 *
 * `slug` is a stable human-readable identifier (e.g. "js_ts") used by the
 * labeling pipeline and brain doc; `id` is a UUID for foreign keys.
 */
@Entity()
export class Niche {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_niche_id',
  })
  id: string;

  @Column({ type: 'text' })
  @Index('IDX_niche_slug', { unique: true })
  slug: string;

  @Column({ type: 'text' })
  title: string;

  @Column({
    type: 'text',
    default: NicheBucketGroup.Theme,
  })
  bucketGroup: NicheBucketGroup;

  /**
   * Null for a niche the taxonomy has not placed yet. Such a niche is still
   * ranked on its own; it simply cannot appear in a domain's ranking, which is
   * the safe direction to fail in.
   */
  @Column({ type: 'text', nullable: true })
  @Index('IDX_niche_domain')
  domain: NicheDomain | null;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
