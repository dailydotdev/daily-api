import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from './user';
import type { Feed } from './Feed';
import type { Source } from './Source';

export enum UserInterestStatus {
  Active = 'active',
  Paused = 'paused',
  Stopped = 'stopped',
}

export enum UserInterestCadence {
  Hourly = 'hourly',
  Daily = 'daily',
  Weekly = 'weekly',
}

export type UserInterestSources = {
  dailyDev: boolean;
  web: boolean;
  github: boolean;
};

export type UserInterestOutputModes = {
  feed: boolean;
  post: boolean;
  digest: boolean;
  notification: boolean;
};

export const defaultUserInterestSources: UserInterestSources = {
  dailyDev: true,
  web: true,
  github: false,
};

export const defaultUserInterestOutputModes: UserInterestOutputModes = {
  feed: true,
  post: true,
  digest: false,
  notification: true,
};

@Entity()
@Index('IDX_user_interest_user_id_status', ['userId', 'status'])
export class UserInterest {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ type: 'text' })
  @Index('IDX_user_interest_user_id')
  userId: string;

  @Column({ type: 'text' })
  query: string;

  @Column({ type: 'text', default: UserInterestStatus.Active })
  status: UserInterestStatus;

  @Column({ type: 'double precision', default: 0.5 })
  fomoThreshold: number;

  @Column({ type: 'jsonb', default: {} })
  sources: UserInterestSources = defaultUserInterestSources;

  @Column({ type: 'jsonb', default: {} })
  outputModes: UserInterestOutputModes = defaultUserInterestOutputModes;

  @Column({ type: 'text', nullable: true })
  feedId: string | null;

  @Column({ type: 'text', nullable: true })
  sourceId: string | null;

  @Column({
    type: 'text',
    nullable: true,
    default: UserInterestCadence.Hourly,
  })
  cadence: UserInterestCadence | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastRunAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lastRunSummary: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne('User', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Promise<User>;

  @OneToOne('Feed', { lazy: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'feedId' })
  feed: Promise<Feed>;

  @OneToOne('Source', { lazy: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sourceId' })
  source: Promise<Source>;
}
