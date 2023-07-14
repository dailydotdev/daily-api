import { Column, Entity, PrimaryColumn, TableInheritance } from 'typeorm';
import { NotificationType } from './common';

export enum NotificationPreferenceType {
  Post = 'post',
  Comment = 'comment',
  Source = 'source',
}

enum NotificationPreferenceStatus {
  Muted = 'muted',
}

@Entity()
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export class NotificationPreference {
  @PrimaryColumn({ type: 'text' })
  userId: string;

  @PrimaryColumn({ type: 'text' })
  notificationType: NotificationType;

  @Column({ type: 'text' })
  type: NotificationPreferenceType;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'text' })
  status: NotificationPreferenceStatus;
}
