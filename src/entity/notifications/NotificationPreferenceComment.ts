import { ChildEntity, ManyToOne, PrimaryColumn } from 'typeorm';
import { NotificationPreference } from './NotificationPreference';
import { NotificationPreferenceType } from '../../notifications/common';
import { Comment } from '../Comment';

@ChildEntity(NotificationPreferenceType.Comment)
export class NotificationPreferenceComment extends NotificationPreference {
  @PrimaryColumn({ type: 'text', default: null })
  commentId?: string;

  @ManyToOne(() => Comment, { lazy: true, onDelete: 'CASCADE' })
  comment: Promise<Comment>;
}
