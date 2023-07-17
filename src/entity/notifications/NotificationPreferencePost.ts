import { ChildEntity, ManyToOne, PrimaryColumn } from 'typeorm';
import { Post } from '../posts';
import { NotificationPreferenceType } from '../../notifications/common';
import { NotificationPreference } from './NotificationPreference';

@ChildEntity(NotificationPreferenceType.Post)
export class NotificationPreferencePost extends NotificationPreference {
  @PrimaryColumn({ type: 'text', default: null })
  postId?: string;

  @ManyToOne(() => Post, { lazy: true, onDelete: 'CASCADE' })
  post: Promise<Post>;
}
