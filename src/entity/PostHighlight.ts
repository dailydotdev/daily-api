import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Post } from './posts/Post';

@Entity()
@Index('IDX_post_highlight_channel_rank', ['channel', 'rank'])
export class PostHighlight {
  @PrimaryColumn({ type: 'text' })
  channel: string;

  @PrimaryColumn({ type: 'text' })
  @Index('IDX_post_highlight_post')
  postId: string;

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
