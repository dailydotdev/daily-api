import { ChildEntity, ManyToMany, PrimaryColumn } from 'typeorm';
import { Source } from '../Source';
import { NotificationPreferenceType } from '../../notifications';

@ChildEntity(NotificationPreferenceType.Source)
export class NotificationPreferencePost {
  @PrimaryColumn({ type: 'text' })
  sourceId: string;

  @ManyToMany(() => Source, { lazy: true, onDelete: 'CASCADE' })
  source: Promise<Source>;
}
