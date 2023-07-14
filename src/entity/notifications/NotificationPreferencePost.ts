import { ChildEntity, OneToOne, PrimaryColumn } from 'typeorm';
import { NotificationPreferenceType } from './NotificationPreference';
import { Post } from '../posts';

@ChildEntity(NotificationPreferenceType.Post)
export class NotificationPreferencePost {
  @PrimaryColumn({ type: 'text' })
  postId: string;

  @OneToOne(() => Post, { lazy: true, onDelete: 'CASCADE' })
  post: Promise<Post>;
}
