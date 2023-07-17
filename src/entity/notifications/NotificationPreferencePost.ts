import { ChildEntity, ManyToMany, PrimaryColumn } from 'typeorm';
import { Post } from '../posts';
import { NotificationPreferenceType } from '../../notifications/common';

@ChildEntity(NotificationPreferenceType.Post)
export class NotificationPreferencePost {
  @PrimaryColumn({ type: 'text' })
  postId: string;

  @ManyToMany(() => Post, { lazy: true, onDelete: 'CASCADE' })
  post: Promise<Post>;
}
