import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { NotificationAttachmentType } from './NotificationAttachment';

@Entity()
@Index('IDX_notification_attch_v2_type_reference_id', ['type', 'referenceId'])
export class NotificationAttachmentV2 {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  type: NotificationAttachmentType;

  @Column({ type: 'text' })
  image: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  referenceId: string;
}
