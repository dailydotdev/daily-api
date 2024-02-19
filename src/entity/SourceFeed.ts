import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { Source } from './Source';

@Entity()
@Index(['sourceId', 'feed'], { unique: true })
export class SourceFeed {
  @Column()
  sourceId: string;

  @ManyToOne(() => Source, (source) => source.feeds, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  source: Promise<Source>;

  @PrimaryColumn({ type: 'text' })
  feed: string;

  @Column({ nullable: true })
  lastFetched: Date;
}
