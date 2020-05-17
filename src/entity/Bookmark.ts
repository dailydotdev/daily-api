import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { Post } from './Post';

@Entity()
@Index('IDX_bookmark_userId_createdAt', { synchronize: false })
export class Bookmark {
  @PrimaryColumn({ type: 'text' })
  @Index()
  postId: string;

  @PrimaryColumn({ type: 'text' })
  @Index()
  userId: string;

  @ManyToOne(() => Post, (post) => post.tags, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  post: Promise<Post>;

  @Column({ default: () => 'now()' })
  @Index('IDX_bookmark_createdAt', { synchronize: false })
  createdAt: Date;
}
