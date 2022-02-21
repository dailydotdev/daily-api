import { Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from './User';
import { Comment } from './Comment';

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
  comment?: Promise<Comment>;

  @ManyToOne(() => User, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  mentionedUser?: Promise<User>;
}
