import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { NotificationType } from '../../notifications/common';

export type NotificationReferenceType =
  | 'user_top_reader'
  | 'streak'
  | 'source_request'
  | 'squad_request'
  | 'post'
  | 'submission'
  | 'comment'
  | 'source'
  | 'system';

@Entity()
@Index('ID_notification_v2_reference', ['referenceId', 'referenceType'])
@Index(
  'ID_notification_v2_uniq',
  ['type', 'referenceId', 'referenceType', 'uniqueKey'],
  { unique: true },
)
export class NotificationV2 {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  type: NotificationType;

  @Column({ type: 'text' })
  icon: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text' })
  targetUrl: string;

  @Column({ default: true })
  public: boolean;

  @Column({ type: 'text', nullable: true })
  referenceId?: string;

  @Column({ type: 'text', nullable: true })
  referenceType?: NotificationReferenceType;

  @Column({ type: 'text', default: '0' })
  uniqueKey?: string;

  @Column({ type: 'int', nullable: true })
  numTotalAvatars?: number;

  @Column({ type: 'uuid', array: true, default: null })
  attachments: string[];

  @Column({ type: 'uuid', array: true, default: null })
  avatars: string[];
}
