import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Post } from '../posts';

@Entity()
export class SearchRecommendation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'text' })
  postId: string;

  @Column({ type: 'text' })
  question: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @ManyToOne(() => Post, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  post: Promise<Post>;
}
