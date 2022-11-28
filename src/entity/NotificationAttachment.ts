import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { Notification } from './Notification';

export type NotificationAttachmentType = 'post';

@Entity()
export class NotificationAttachment {
  @PrimaryColumn({ type: 'uuid' })
  @Index('IDX_notification_attch_id')
  notificationId: string;

  @PrimaryColumn()
  order: number;

  @Column({ type: 'text' })
  type: NotificationAttachmentType;

  @Column({ type: 'text' })
  image: string;

  @Column({ type: 'text' })
  title: string;

  @ManyToOne(() => Notification, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  notification: Promise<Notification>;
}
