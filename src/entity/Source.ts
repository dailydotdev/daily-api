import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { SourceDisplay } from './SourceDisplay';
import { SourceFeed } from './SourceFeed';
import { Post } from './Post';

@Entity()
export class Source {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ type: 'text', nullable: true })
  twitter?: string;

  @Column({ type: 'text', nullable: true })
  website?: string;

  @OneToMany(() => SourceDisplay, (display) => display.source, { lazy: true })
  displays: Promise<SourceDisplay[]>;

  @OneToMany(() => SourceFeed, (feed) => feed.source, { lazy: true })
  feeds: Promise<SourceFeed[]>;

  @OneToMany(() => Post, (post) => post.source, { lazy: true })
  posts: Promise<Post[]>;
}
