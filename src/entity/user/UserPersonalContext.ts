import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from './User';

export enum PersonalContextSource {
  Github = 'github',
  Website = 'website',
}

export enum PersonalContextStatus {
  Pending = 'pending',
  Ok = 'ok',
  Error = 'error',
}

@Entity()
export class UserPersonalContext {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  userId: string;

  @PrimaryColumn({ type: 'text' })
  source: PersonalContextSource;

  @Column({ type: 'text' })
  sourceValue: string;

  @Column({ type: 'boolean', default: false })
  verified: boolean;

  @Column({ type: 'text', default: PersonalContextStatus.Pending })
  status: PersonalContextStatus;

  @Column({ type: 'text', nullable: true })
  profileText: string | null;

  @Column({ type: 'jsonb', nullable: true })
  context: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'text', nullable: true })
  correlationId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  requestedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  generatedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne('User', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Promise<User>;
}
