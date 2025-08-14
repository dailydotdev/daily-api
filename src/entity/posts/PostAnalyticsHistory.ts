import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Post } from './Post';

@Entity()
export class PostAnalyticsHistory {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column()
  date: string;

  @Column({ default: 0 })
  impressions: number;

  // not added to migration because raw events data has some invalid post ids
  @OneToOne('Post', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id' })
  post: Promise<Post>;
}
