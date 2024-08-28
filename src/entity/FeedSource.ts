import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import type { Feed } from './Feed';
import type { Source } from './Source';

@Entity()
export class FeedSource {
  @PrimaryColumn({ type: 'text' })
  @Index()
  feedId: string;

  @PrimaryColumn({ type: 'text' })
  @Index()
  sourceId: string;

  @Column({ default: true })
  blocked: boolean;

  @ManyToOne('Feed', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  feed: Promise<Feed>;

  @ManyToOne('Source', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  source: Promise<Source>;
}
