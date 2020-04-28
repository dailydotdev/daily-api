import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { Field, ObjectType } from 'type-graphql';
import { SourceDisplay } from './SourceDisplay';
import { SourceFeed } from './SourceFeed';
import { PostDisplay } from './PostDisplay';

@Entity()
@ObjectType({ description: 'Source to discover posts from (usually blogs)' })
export class Source {
  @PrimaryColumn({ type: 'text' })
  @Field({ description: 'Short unique string to identify the source' })
  id: string;

  @Column({ type: 'text', nullable: true })
  twitter?: string;

  @Column({ type: 'text', nullable: true })
  website?: string;

  @Field({ description: 'Name of the source' })
  name: string;

  @Field({ description: 'URL to a thumbnail image of the source' })
  image: string;

  @Field({ description: 'Whether the source is public', defaultValue: true })
  public: boolean;

  @OneToMany(() => SourceDisplay, (display) => display.source, { lazy: true })
  displays: Promise<SourceDisplay[]>;

  @OneToMany(() => SourceFeed, (feed) => feed.source, { lazy: true })
  feeds: Promise<SourceFeed[]>;

  @OneToMany(() => PostDisplay, (post) => post.source, { lazy: true })
  posts: Promise<PostDisplay[]>;
}
