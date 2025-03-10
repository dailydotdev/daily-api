import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import type { User } from './user';
import type { Bookmark } from './Bookmark';

@Entity()
export class BookmarkList {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  @Index()
  userId: string;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;

  @Column({ type: 'text' })
  @Index('bookmark_list_idx_lowername_asc', { synchronize: false })
  name: string;

  @Column({ type: 'text', nullable: true })
  icon?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany('Bookmark', (bookmark: Bookmark) => bookmark.listId, {
    lazy: true,
  })
  bookmarks: Promise<Bookmark[]>;
}
