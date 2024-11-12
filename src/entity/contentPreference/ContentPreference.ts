import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  TableInheritance,
} from 'typeorm';
import type { User } from '../user/User';
import { ContentPreferenceStatus, ContentPreferenceType } from './types';
import type { Feed } from '../Feed';

@Entity()
@TableInheritance({ column: { type: 'text', name: 'type' } })
@Index(['userId', 'status', 'type'])
export class ContentPreference {
  @PrimaryColumn({ type: 'text' })
  referenceId: string;

  @PrimaryColumn({ type: 'text' })
  userId: string;

  @PrimaryColumn({ type: 'text' })
  type: ContentPreferenceType;

  @PrimaryColumn({ type: 'text', default: null })
  feedId: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'text' })
  status: ContentPreferenceStatus;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;

  @ManyToOne('Feed', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'feedId' })
  feed: Promise<Feed>;
}
