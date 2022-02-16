import { Comment } from './Comment';
import { Entity, ManyToOne, PrimaryColumn } from 'typeorm';

@Entity()
export class CommentMention {
  @PrimaryColumn({ type: 'text' })
  commentId: string;

  @PrimaryColumn({ type: 'text' })
  mentionedUserId: string;

  @ManyToOne(() => Comment, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  comment: Promise<Comment>;
}
