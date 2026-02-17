import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { User } from './user';

@Entity()
export class FeedSentiment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_feed_sentiment_user_id')
  @Column({ length: 36 })
  userId: string;

  @Column({
    type: 'varchar',
    length: 20,
    comment: 'Sentiment: good, neutral, or bad',
  })
  @Index('IDX_feed_sentiment_sentiment')
  sentiment: string;

  @CreateDateColumn()
  @Index('IDX_feed_sentiment_created_at')
  createdAt: Date;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}
