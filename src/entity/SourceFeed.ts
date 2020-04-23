import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { Source } from './Source';

@Entity()
export class SourceFeed {
  @Column()
  @Index()
  sourceId: string;

  @ManyToOne(() => Source, (source) => source.feeds, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  source: Promise<Source>;

  @PrimaryColumn({ type: 'text' })
  feed: string;
}
