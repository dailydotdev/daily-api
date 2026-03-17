import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import type { Post } from './posts/Post';

@Entity()
@Unique('UQ_post_highlight_channel_post', ['channel', 'postId'])
@Index('IDX_post_highlight_channel_rank', ['channel', 'rank'])
export class PostHighlight {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  @Index('IDX_post_highlight_post')
  postId: string;

  @Column({ type: 'text' })
  channel: string;

  @Column({ type: 'smallint' })
  rank: number;

  @Column({ type: 'text' })
  headline: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne('Post', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  post: Promise<Post>;
}
