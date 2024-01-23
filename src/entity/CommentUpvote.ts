import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { Comment } from './Comment';
import { User } from './user';

@Entity()
export class CommentUpvote {
  @PrimaryColumn({ length: 14 })
  @Index()
  commentId: string;

  @PrimaryColumn({ length: 36 })
  @Index()
  userId: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @ManyToOne(() => Comment, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  comment: Promise<Comment>;

  @ManyToOne(() => User, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}
