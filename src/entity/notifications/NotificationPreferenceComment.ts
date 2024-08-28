import { ChildEntity, Column, ManyToOne } from 'typeorm';
import { NotificationPreference } from './NotificationPreference';
import { NotificationPreferenceType } from '../../notifications/common';
import type { Comment } from '../Comment';

@ChildEntity(NotificationPreferenceType.Comment)
export class NotificationPreferenceComment extends NotificationPreference {
  @Column({ type: 'text', default: null })
  commentId: string;

  @ManyToOne('Comment', { lazy: true, onDelete: 'CASCADE' })
  comment: Promise<Comment>;
}
