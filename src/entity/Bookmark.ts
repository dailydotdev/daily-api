import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { BookmarkList } from './BookmarkList';
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
  listId: string;

  @Column({ type: 'timestamp', nullable: true })
  remindAt: Date;

  @ManyToOne('Post', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  post: Promise<Post>;

  @ManyToOne(() => BookmarkList, {
    lazy: true,
    onDelete: 'SET NULL',
  })
  list: Promise<BookmarkList>;

  @Column({ default: () => 'now()' })
  @Index('IDX_bookmark_createdAt', { synchronize: false })
  createdAt: Date;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}
