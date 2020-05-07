import { Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { Feed } from './Feed';
import { Source } from './Source';

@Entity()
export class FeedSource {
  @PrimaryColumn({ type: 'text' })
  @Index()
  feedId: string;

  @PrimaryColumn({ type: 'text' })
  @Index()
  sourceId: string;

  @ManyToOne(() => Feed, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  feed: Promise<Feed>;

  @ManyToOne(() => Source, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  source: Promise<Source>;
}
