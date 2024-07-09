import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import type { Source } from './Source';

@Entity()
@Index(['sourceId', 'feed'], { unique: true })
export class SourceFeed {
  @Column()
  sourceId: string;

  @ManyToOne('Source', (source: Source) => source.feeds, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  source: Promise<Source>;

  @PrimaryColumn({ type: 'text' })
  feed: string;

  @Column({ nullable: true })
  lastFetched: Date;
}
