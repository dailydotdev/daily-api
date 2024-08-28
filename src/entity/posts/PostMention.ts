import { Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import type { User } from '../user';
import type { Post } from './Post';

@Entity()
export class PostMention {
  @PrimaryColumn()
  postId: string;

  @PrimaryColumn({ length: 36 })
  mentionedByUserId: string;

  @PrimaryColumn({ length: 36 })
  mentionedUserId: string;

  @ManyToOne('Post', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  post?: Promise<Post>;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  mentionedByUser?: Promise<User>;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  mentionedUser?: Promise<User>;
}
