import { ChildEntity, ManyToOne, PrimaryColumn } from 'typeorm';
import { Source } from '../Source';
import { NotificationPreferenceType } from '../../notifications/common';
import { NotificationPreference } from './NotificationPreference';

@ChildEntity(NotificationPreferenceType.Source)
export class NotificationPreferenceSource extends NotificationPreference {
  @PrimaryColumn({ type: 'text', default: null })
  sourceId?: string;

  @ManyToOne(() => Source, { lazy: true, onDelete: 'CASCADE' })
  source: Promise<Source>;
}
