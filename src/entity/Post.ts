import {
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { PostTag } from './PostTag';
import { Source } from './Source';

@Entity()
export class Post {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ nullable: true })
  publishedAt?: Date;

  @Column({ default: () => 'now()' })
  @Index('ignored_index', { synchronize: false })
  createdAt: Date;

  @Column({ type: 'text' })
  @Index()
  sourceId: string;

  @ManyToOne(() => Source, (source) => source.posts, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  source: Promise<Source>;

  @Column({ type: 'text' })
  @Index()
  url: string;

  @Column({ type: 'text', nullable: true })
  @Index()
  canonicalUrl?: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  image?: string;

  @Column({ type: 'float', nullable: true })
  ratio?: number;

  @Column({ type: 'text', nullable: true })
  placeholder?: string;

  @Column({ default: false })
  tweeted: boolean;

  @Column({ default: 0 })
  views: number;

  @Column({ type: 'float' })
  @Index()
  timeDecay: number;

  @Column({ type: 'float' })
  @Index('ignored_index', { synchronize: false })
  score: number;

  @Column({ type: 'text', nullable: true })
  siteTwitter?: string;

  @Column({ type: 'text', nullable: true })
  creatorTwitter?: string;

  @Column({ nullable: true })
  readTime?: number;

  @OneToMany(() => PostTag, (tag) => tag.post, { lazy: true })
  tags: Promise<PostTag[]>;
}
