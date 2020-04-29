import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { Field, ID, ObjectType } from 'type-graphql';
import { PostTag } from './PostTag';
import { Source } from './Source';

@Entity()
@ObjectType({ description: 'Entity for saving reference to blog posts' })
export class Post {
  @PrimaryColumn({ type: 'text' })
  @Field(() => ID, { description: 'Unique identifier' })
  id: string;

  @Column({ nullable: true })
  @Field({ description: 'Time the post was published', nullable: true })
  publishedAt?: Date;

  @CreateDateColumn()
  @Field({ description: 'Time the post was added to the database' })
  @Index()
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
  @Field({ description: 'URL to the post' })
  @Index()
  url: string;

  @Column({ type: 'text', nullable: true })
  @Index()
  canonicalUrl?: string;

  @Column({ type: 'text' })
  @Field({ description: 'Title of the post' })
  title: string;

  @Column({ type: 'text', nullable: true })
  @Field({ description: 'URL to the image of post', nullable: true })
  image?: string;

  @Column({ type: 'float', nullable: true })
  @Field({ description: 'Aspect ratio of the image', nullable: true })
  ratio?: number;

  @Column({ type: 'text', nullable: true })
  @Field({ description: 'Tiny version of the image in base64', nullable: true })
  placeholder?: string;

  @Column({ default: false })
  tweeted: boolean;

  @Column({ default: 0 })
  views: number;

  @Column({ type: 'float' })
  @Index()
  timeDecay: number;

  @Column({ type: 'float' })
  @Index()
  score: number;

  @Column({ type: 'text', nullable: true })
  siteTwitter?: string;

  @Column({ type: 'text', nullable: true })
  creatorTwitter?: string;

  @Column({ nullable: true })
  @Field({
    description: 'Estimation of time to read the article (in minutes)',
    nullable: true,
  })
  readTime?: number;

  @OneToMany(() => PostTag, (tag) => tag.post, { lazy: true })
  tags: Promise<PostTag[]>;
}
