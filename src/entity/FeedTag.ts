import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { Feed } from './Feed';

@Entity()
@Index('IDX_feed_id_blocked', ['feedId', 'blocked'])
export class FeedTag {
  @PrimaryColumn({ type: 'text' })
  feedId: string;

  @PrimaryColumn({ type: 'text' })
  tag: string;

  @Column({ default: false })
  blocked: boolean;

  @ManyToOne(() => Feed, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  feed: Promise<Feed>;
}
