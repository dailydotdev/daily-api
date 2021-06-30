import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { Feed } from './Feed';

@Entity()
export class FeedTag {
  @PrimaryColumn({ type: 'text' })
  @Index()
  feedId: string;

  @PrimaryColumn({ type: 'text' })
  @Index()
  tag: string;

  @Column({ default: false })
  @Index('IDX_feedTag_blocked')
  blocked: boolean;

  @ManyToOne(() => Feed, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  feed: Promise<Feed>;
}
