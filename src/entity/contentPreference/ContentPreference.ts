import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryColumn,
  TableInheritance,
} from 'typeorm';
import type { User } from '../user/User';
import { ContentPreferenceStatus, ContentPreferenceType } from './types';

@Entity()
@TableInheritance({ column: { type: 'text', name: 'type' } })
@Index(['userId', 'status', 'type'])
export class ContentPreference {
  @PrimaryColumn({ type: 'text' })
  referenceId: string;

  @PrimaryColumn({ type: 'text' })
  userId: string;

  @Column({ type: 'text' })
  type: ContentPreferenceType;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'text' })
  status: ContentPreferenceStatus;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}
