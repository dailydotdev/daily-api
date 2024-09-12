import { ChildEntity, Column, JoinColumn, ManyToOne } from 'typeorm';
import type { User } from '../user/User';
import { NotificationPreference } from './NotificationPreference';
import { NotificationPreferenceType } from '../../notifications/common';

@ChildEntity(NotificationPreferenceType.User)
export class NotificationPreferenceUser extends NotificationPreference {
  @Column({ type: 'text', default: null })
  referenceUserId: string;

  @ManyToOne('Source', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referenceUserId' })
  user: Promise<User>;
}
