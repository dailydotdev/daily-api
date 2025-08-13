import {
  Column,
  CreateDateColumn,
  Entity,
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

  @OneToOne('Post', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  post: Promise<Post>;
}
