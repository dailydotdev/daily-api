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
@Index('idx_content_preferences_referenceid_type_status', [
  'referenceId',
  'type',
  'status',
])
@Index('idx_content_preferences_userid_referenceid_type', [
  'userId',
  'referenceId',
  'type',
])
@Index([
  'idx_content_preferences_feedid_type_status',
  'feedId',
  'type',
  'status',
])
@Index('idx_content_preferences_feedid_type_userid_status', [
  'feedId',
  'type',
  'userId',
  'status',
])
export class ContentPreference {
  @PrimaryColumn({ type: 'text' })
  referenceId: string;

  @PrimaryColumn({ type: 'text' })
  userId: string;

  @PrimaryColumn({ type: 'text' })
  type: ContentPreferenceType;

  @PrimaryColumn({ type: 'text' })
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
