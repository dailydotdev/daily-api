import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { Field, ID, ObjectType } from 'type-graphql';
import { PostDisplay } from './PostDisplay';
import { PostTag } from './PostTag';

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

  @OneToMany(() => PostDisplay, (display) => display.post, { lazy: true })
  displays: Promise<PostDisplay[]>;

  @OneToMany(() => PostTag, (tag) => tag.post, { lazy: true })
  tags: Promise<PostTag[]>;
}
