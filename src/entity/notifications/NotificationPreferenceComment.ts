import { ChildEntity, ManyToMany, PrimaryColumn } from 'typeorm';
import { NotificationPreferenceType } from '../../notifications';
import { Comment } from '../Comment';

@ChildEntity(NotificationPreferenceType.Comment)
export class NotificationPreferencePost {
  @PrimaryColumn({ type: 'text' })
  commentId: string;

  @ManyToMany(() => Comment, { lazy: true, onDelete: 'CASCADE' })
  comment: Promise<Comment>;
}
