import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { SentimentGroup } from './SentimentGroup';

@Entity()
@Index('IDX_sentiment_entity_group_id', ['groupId'])
@Unique('UQ_sentiment_entity_entity', ['entity'])
export class SentimentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  groupId: string;

  @ManyToOne('SentimentGroup', (group: SentimentGroup) => group.entities, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'groupId' })
  group: Promise<SentimentGroup>;

  @Column({ type: 'text' })
  entity: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text' })
  logo: string;

  @CreateDateColumn()
  createdAt: Date;
}
