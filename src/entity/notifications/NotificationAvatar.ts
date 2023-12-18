import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { Notification } from './Notification';
import { NotificationAvatarType } from './NotificationAvatarV2';

@Entity()
@Index('IDX_notification_avatar_type_reference_id', ['type', 'referenceId'])
export class NotificationAvatar {
  @PrimaryColumn({ type: 'uuid' })
  @Index('IDX_notification_avatar_id')
  notificationId: string;

  @PrimaryColumn()
  order: number;

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

  @ManyToOne(() => Notification, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  notification: Promise<Notification>;
}
