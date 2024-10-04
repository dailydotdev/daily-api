import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import type { User } from '../user';
import { NotificationV2 } from './NotificationV2';

@Entity()
@Index('IDX_user_notification_user_id_created_at', [
  'userId',
  'public',
  'createdAt',
])
@Index('IDX_user_notification_user_id_read_at', ['userId', 'readAt'])
@Index(
  'IDX_user_notification_userId_uniqueKey_unique',
  ['userId', 'uniqueKey'],
  {
    unique: true,
    where: `"uniqueKey" IS NOT NULL`,
  },
)
export class UserNotification {
  @PrimaryColumn({ type: 'uuid' })
  notificationId: string;

  @PrimaryColumn({ length: 36 })
  userId: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ nullable: true })
  readAt?: Date;

  @Column({ default: true })
  public: boolean;

  @ManyToOne(() => NotificationV2, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  notification: Promise<NotificationV2>;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;

  @Column({ type: 'text', nullable: true })
  uniqueKey: string | null;
}
