import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import type { Post } from './posts';
import type { User } from './user';

@Entity()
@Index(['userId', 'timestamp'])
@Index(['postId', 'userId'])
@Index(['postId', 'userId', 'hidden'])
export class View {
  @PrimaryColumn({ type: 'text' })
  @Index()
  postId: string;

  @ManyToOne('Post', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  post: Promise<Post>;

  @PrimaryColumn({ length: 36, type: 'varchar' })
  @Index()
  userId: string;

  @Column({ type: 'text', nullable: true })
  referer?: string;

  @PrimaryColumn({ default: () => 'now()' })
  @Index()
  timestamp: Date;

  @Column({ type: 'bool', default: false })
  hidden?: boolean;
}
