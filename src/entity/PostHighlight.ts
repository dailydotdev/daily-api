import {
  Column,
  Entity,
  Index,
  CreateDateColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Post } from './posts/Post';

@Entity()
@Index('IDX_post_highlight_channel_highlightedAt', ['channel', 'highlightedAt'])
@Index('UQ_post_highlight_channel_post', ['channel', 'postId'], {
  unique: true,
})
export class PostHighlight {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  channel: string;

  @Column({ type: 'text' })
  @Index('IDX_post_highlight_post')
  postId: string;

  @Column({ type: 'timestamp' })
  highlightedAt: Date;

  @Column({ type: 'text' })
  headline: string;

  @Column({ type: 'text', nullable: true })
  significanceLabel: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne('Post', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  post: Promise<Post>;
}
