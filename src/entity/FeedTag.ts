import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Feed } from './Feed';

@Entity()
@Index('IDX_feed_id_blocked', ['feedId', 'blocked'])
export class FeedTag {
  @PrimaryColumn({ type: 'text' })
  feedId: string;

  @PrimaryColumn({ type: 'text' })
  tag: string;

  @Column({ default: false })
  blocked: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @Index()
  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne('Feed', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  feed: Promise<Feed>;
}
