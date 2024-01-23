import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../user';
import { NotificationV2 } from './NotificationV2';

@Entity()
@Index('IDX_user_notification_user_id_created_at', [
  'userId',
  'public',
  'createdAt',
])
@Index('IDX_user_notification_user_id_read_at', ['userId', 'readAt'])
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

  @ManyToOne(() => User, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}
