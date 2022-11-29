import {
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './User';
import { NotificationAvatar } from './NotificationAvatar';
import { NotificationAttachment } from './NotificationAttachment';

export type NotificationType =
  | 'community_picks_failed'
  | 'community_picks_succeeded'
  | 'community_picks_granted'
  | 'article_picked'
  | 'article_new_comment'
  | 'article_upvote_milestone'
  | 'article_report_approved'
  | 'article_analytics'
  | 'source_approved'
  | 'source_rejected'
  | 'new_badge'
  | 'comment_mention'
  | 'comment_reply'
  | 'comment_upvote_milestone';

@Entity()
@Index('IDX_notification_user_id_created_at', ['userId', 'public', 'createdAt'])
@Index('IDX_notification_user_id_read_at', ['userId', 'readAt'])
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
