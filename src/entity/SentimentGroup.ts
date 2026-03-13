import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import type { SentimentEntity } from './SentimentEntity';

@Entity()
export class SentimentGroup {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'text' })
  name: string;

  @OneToMany('SentimentEntity', (entity: SentimentEntity) => entity.group, {
    lazy: true,
  })
  entities: Promise<SentimentEntity[]>;

  @CreateDateColumn()
  createdAt: Date;
}
