import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type NotificationAvatarType = 'source' | 'user' | 'top_reader_badge';

@Entity()
@Index(
  'IDX_notification_avatar_v2_type_reference_id',
  ['type', 'referenceId'],
  { unique: true },
)
export class NotificationAvatarV2 {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  type: NotificationAvatarType;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text' })
  image: string;

  @Column({ type: 'text' })
  targetUrl: string;

  @Column({ type: 'text' })
  referenceId: string;
}
