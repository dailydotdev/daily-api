import { ChildEntity, Column, ManyToOne } from 'typeorm';
import type { Source } from '../Source';
import { NotificationPreferenceType } from '../../notifications/common';
import { NotificationPreference } from './NotificationPreference';

@ChildEntity(NotificationPreferenceType.Source)
export class NotificationPreferenceSource extends NotificationPreference {
  @Column({ type: 'text', default: null })
  sourceId: string;

  @ManyToOne('Source', { lazy: true, onDelete: 'CASCADE' })
  source: Promise<Source>;
}
