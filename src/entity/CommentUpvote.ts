import { Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import BaseUpvote from './BaseUpvote';
import { Comment } from './Comment';

@Entity()
export class CommentUpvote extends BaseUpvote {
  @PrimaryColumn({ length: 14 })
  @Index()
  commentId: string;

  @ManyToOne(() => Comment, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  comment: Promise<Comment>;
}
