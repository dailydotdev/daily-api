import { ArticleType } from './ArticleType';
import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  ManyToOne,
} from 'typeorm';
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

  @Column({ default: true })
  @Index()
  active: boolean;

  @Column({ default: 0 })
  rankBoost: number;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text' })
  image: string;

  @Column({ default: false })
  private: boolean;

  @Column({ type: 'text', default: null })
  @Index()
  articleTypeId: string;

  @ManyToOne(() => ArticleType, (articleType) => articleType.sources, {
    lazy: true,
    onDelete: 'SET NULL',
  })
  articleType: Promise<ArticleType>;

  @OneToMany(() => SourceDisplay, (display) => display.source, { lazy: true })
  displays: Promise<SourceDisplay[]>;

  @OneToMany(() => SourceFeed, (feed) => feed.source, { lazy: true })
  feeds: Promise<SourceFeed[]>;

  @OneToMany(() => Post, (post) => post.source, { lazy: true })
  posts: Promise<Post[]>;
}
