import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import type { User } from './user';

export const MAX_PERSONAL_ACCESS_TOKENS_PER_USER = 5;
export const PERSONAL_ACCESS_TOKEN_PREFIX = 'dda_';

@Entity()
@Index('IDX_pat_userId', ['userId'])
@Index('IDX_pat_tokenHash', ['tokenHash'], { unique: true })
export class PersonalAccessToken {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'text' })
  userId: string;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text' })
  tokenHash: string;

  @Column({ type: 'text' })
  tokenPrefix: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date | null;
}
