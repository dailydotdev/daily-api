import { ChildEntity, Column, ManyToOne } from 'typeorm';
import type { Post } from '../posts';
import { NotificationPreferenceType } from '../../notifications/common';
import { NotificationPreference } from './NotificationPreference';

@ChildEntity(NotificationPreferenceType.Post)
export class NotificationPreferencePost extends NotificationPreference {
  @Column({ type: 'text', default: null })
  postId: string;

  @ManyToOne('Post', { lazy: true, onDelete: 'CASCADE' })
  post: Promise<Post>;
}
