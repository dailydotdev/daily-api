import { Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from './user';
import { Comment } from './Comment';

@Entity()
export class CommentMention {
  @PrimaryColumn({ length: 14 })
  commentId: string;

  @PrimaryColumn({ length: 36 })
  commentByUserId: string;

  @PrimaryColumn({ length: 36 })
  mentionedUserId: string;

  @ManyToOne(() => Comment, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  comment?: Promise<Comment>;

  @ManyToOne(() => User, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  commentByUser?: Promise<User>;

  @ManyToOne(() => User, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  mentionedUser?: Promise<User>;
}
