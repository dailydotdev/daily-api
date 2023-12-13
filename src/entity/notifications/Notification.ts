import {
  Column,
  DataSource,
  Entity,
  Index,
  IsNull,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../User';
import { NotificationAvatar } from './NotificationAvatar';
import { NotificationAttachment } from './NotificationAttachment';
import { NotificationType } from '../../notifications/common';
import { UserNotification } from './UserNotification';

export type NotificationReferenceType =
  | 'source_request'
  | 'post'
  | 'submission'
  | 'comment'
  | 'source'
  | 'system';

@Entity()
@Index('IDX_notification_user_id_created_at', ['userId', 'public', 'createdAt'])
@Index('IDX_notification_user_id_read_at', ['userId', 'readAt'])
@Index('ID_notification_reference', ['referenceId', 'referenceType'])
@Index(
  'ID_notification_uniqueness',
  ['type', 'userId', 'referenceId', 'referenceType', 'uniqueKey'],
  { unique: true },
)
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 36 })
  @Index('IDX_notification_user_id')
  userId: string;

  @Column({ type: 'text' })
  type: NotificationType;

  @Column({ type: 'text' })
  icon: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ nullable: true })
  readAt?: Date;

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

  @ManyToOne(() => User, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;

  @OneToMany(() => NotificationAvatar, (avatar) => avatar.notification, {
    lazy: true,
  })
  avatars: Promise<NotificationAvatar[]>;

  @OneToMany(
    () => NotificationAttachment,
    (attachment) => attachment.notification,
    { lazy: true },
  )
  attachments: Promise<NotificationAttachment[]>;
}

export const getUnreadNotificationsCount = async (
  con: DataSource,
  userId: string,
) =>
  await con.getRepository(UserNotification).count({
    where: {
      userId,
      public: true,
      readAt: IsNull(),
    },
  });

export const getNotificationAndChildren = (
  con: DataSource,
  id: string,
): Promise<
  [Notification | null, NotificationAttachment[], NotificationAvatar[]]
> => {
  return Promise.all([
    con.getRepository(Notification).findOneBy({ id }),
    con.getRepository(NotificationAttachment).find({
      where: { notificationId: id },
      order: { order: 'asc' },
    }),
    con.getRepository(NotificationAvatar).find({
      where: { notificationId: id },
      order: { order: 'asc' },
    }),
  ]);
};
