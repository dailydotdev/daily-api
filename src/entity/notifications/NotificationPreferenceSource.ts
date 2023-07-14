import { ChildEntity, ManyToOne, PrimaryColumn } from 'typeorm';
import { NotificationPreferenceType } from './NotificationPreference';
import { Source } from '../Source';

@ChildEntity(NotificationPreferenceType.Source)
export class NotificationPreferencePost {
  @PrimaryColumn({ type: 'text' })
  sourceId: string;

  @ManyToOne(() => Source, (source) => source.posts, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  source: Promise<Source>;
}
