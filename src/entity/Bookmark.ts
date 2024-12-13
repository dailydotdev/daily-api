import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { BookmarkList } from './BookmarkList';
import type { Post } from './posts';
import type { User } from './user';

@Entity()
@Index('IDX_bookmark_userId_createdAt', { synchronize: false })
export class Bookmark {
  @PrimaryColumn({ type: 'text' })
  @Index()
  postId: string;

  @PrimaryColumn({ type: 'text' })
  userId: string;

  @Column({ type: 'uuid', nullable: true })
  listId: string | null;

  @Column({ type: 'timestamp', nullable: true })
  remindAt: Date;

  @ManyToOne('Post', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  post: Promise<Post>;

  @ManyToOne('BookmarkList', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  list: Promise<BookmarkList>;

  @Column({ default: () => 'now()' })
  @Index('IDX_bookmark_createdAt', { synchronize: false })
  createdAt: Date;

  @UpdateDateColumn()
  @Index('IDX_bookmark_updatedAt', { synchronize: false })
  updatedAt: Date;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}
