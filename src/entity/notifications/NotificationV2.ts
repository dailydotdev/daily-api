import {
  Column,
  DataSource,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { NotificationType } from '../../notifications/common';
import { NotificationReferenceType } from './Notification';
import { NotificationAttachmentV2 } from './NotificationAttachmentV2';
import { NotificationAvatarV2 } from './NotificationAvatarV2';
import { UserNotification } from './UserNotification';
import { ReadStream } from 'fs';

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

export const getNotificationV2AndChildren = (
  con: DataSource,
  id: string,
): Promise<
  [NotificationV2 | null, NotificationAttachmentV2[], NotificationAvatarV2[]]
> => {
  return Promise.all([
    con.getRepository(NotificationV2).findOneBy({ id }),
    con
      .createQueryBuilder()
      .select('na.*')
      .from(NotificationAttachmentV2, 'na')
      .innerJoin(NotificationV2, 'n', 'na.id = any(n.attachments)')
      .where('n.id = :id', { id })
      .orderBy('array_position(n.attachments, na.id)', 'ASC')
      .getRawMany(),
    con
      .createQueryBuilder()
      .select('na.*')
      .from(NotificationAvatarV2, 'na')
      .innerJoin(NotificationV2, 'n', 'na.id = any(n.avatars)')
      .where('n.id = :id', { id })
      .orderBy('array_position(n.avatars, na.id)', 'ASC')
      .getRawMany(),
  ]);
};

export const streamNotificationUsers = (
  con: DataSource,
  id: string,
): Promise<ReadStream> => {
  const query = con
    .createQueryBuilder()
    .select('un."userId"')
    .from(UserNotification, 'un')
    .where('un."notificationId" = :id', { id });
  return query.stream();
};
