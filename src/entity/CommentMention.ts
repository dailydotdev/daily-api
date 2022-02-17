import { Comment } from './Comment';
import { Entity, ManyToOne, PrimaryColumn } from 'typeorm';

@Entity()
export class CommentMention {
  @PrimaryColumn()
  commentId: string;

  @PrimaryColumn()
  mentionedUserId: string;

  @ManyToOne(() => Comment, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  comment: Promise<Comment>;
}
