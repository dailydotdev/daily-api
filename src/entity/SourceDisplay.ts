import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Source } from './Source';

@Entity()
@Index(['sourceId', 'userId'], { unique: true })
@Index(['userId', 'enabled'])
export class SourceDisplay {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sourceId: string;

  @ManyToOne(() => Source, (source) => source.displays, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  source: Promise<Source>;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text' })
  image: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: 'text', nullable: true })
  userId?: string;
}
