import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { Post } from './Post';

@Entity()
@Index(['postId', 'userId'])
export class View {
  @PrimaryColumn({ type: 'text' })
  @Index()
  postId: string;

  @ManyToOne(() => Post, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  post: Promise<Post>;

  @PrimaryColumn({ type: 'text' })
  @Index()
  userId: string;

  @Column({ type: 'text', nullable: true })
  referer?: string;

  @Column({ type: 'text', nullable: true })
  agent?: string;

  @Column({ type: 'text', nullable: true })
  ip?: string;

  @PrimaryColumn({ default: () => 'now()' })
  @Index()
  timestamp: Date;
}
