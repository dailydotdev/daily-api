import { Column, Entity, PrimaryColumn, TableInheritance } from 'typeorm';
import {
  NotificationPreferenceStatus,
  NotificationPreferenceType,
  NotificationType,
} from '../../notifications/common';

@Entity()
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export class NotificationPreference {
  @PrimaryColumn({ type: 'text' })
  referenceId: string;

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
