import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { z } from 'zod';
import type { User } from './User';
import type {
  worldCrestSchema,
  worldLookSchema,
  worldSkySchema,
} from '../../common/schema/userWorld';

/**
 * What a user has made of their own world, one row per user.
 *
 * The split this table encodes is the whole point: the READING writes the
 * world — which districts exist, how large they are, where they rank — and the
 * HAND writes only the dressing. A name sits beside a fact rather than
 * replacing one, the sky was given away because losing it as a readout costs
 * the portrait nothing, and the crest is assembled strictly out of monuments
 * and accents that were earned. Nothing storable here can make a world claim to
 * be bigger than it was read into being.
 *
 * Created lazily on first customisation. No row means the user has never opened
 * the panel, and the serving layer answers with derived suggestions instead —
 * which is why every column is nullable rather than defaulted to a stored copy
 * of whatever the suggestion happened to be on the day the row appeared.
 */
@Entity()
export class UserWorldSettings {
  @PrimaryColumn({ type: 'text' })
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /** What the user calls the place. Null falls back to the generated name. */
  @Column({ type: 'text', nullable: true })
  name: string | null;

  @Column({ type: 'jsonb', nullable: true })
  sky: z.infer<typeof worldSkySchema> | null;

  @Column({ type: 'jsonb', nullable: true })
  crest: z.infer<typeof worldCrestSchema> | null;

  /**
   * A property of the WORLD, not of whoever is looking at it: the grade the
   * owner picks is the grade every visitor sees it through. That is why it sits
   * on this row rather than on a per-viewer preference, and why it is served to
   * viewers rather than only to the owner.
   */
  @Column({ type: 'jsonb', nullable: true })
  look: z.infer<typeof worldLookSchema> | null;

  /**
   * A private world is not readable by anyone but its owner — not the world,
   * not the timeline, not the crest. The crest is the piece built to travel, so
   * this is a real cost rather than a cosmetic toggle, and it is the user's to
   * pay.
   */
  @Column({ type: 'boolean', default: false })
  private: boolean;

  /**
   * A bare render of the world — no name, no stats, no chrome — captured in the
   * owner's own browser and uploaded. The share card is composed around it
   * later, so this stays free of anything that would date it when the card is
   * redesigned.
   *
   * It is captured client-side because the world is WebGL: rendering it server
   * side costs a browser with software GL, several seconds and the better part
   * of a gigabyte, while the owner's machine has already drawn it.
   */
  @Column({ type: 'text', nullable: true })
  plateUrl: string | null;

  /**
   * What the plate was a picture OF: settings and district count folded into one
   * string. A TTL would re-render millions of unchanged worlds, so staleness is
   * decided by comparing this against the world as it stands now.
   */
  @Column({ type: 'text', nullable: true })
  plateVersion: string | null;

  @OneToOne('User', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Promise<User>;
}
