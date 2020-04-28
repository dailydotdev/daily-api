import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { Post } from './Post';
import { Source } from './Source';

@Entity()
@Index(['postId', 'priority'])
@Index(['postId', 'sourceId', 'priority'])
export class PostDisplay {
  @PrimaryColumn()
  @Index()
  postId: string;

  @ManyToOne(() => Post, (post) => post.displays, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  post: Promise<Post>;

  @PrimaryColumn()
  @Index()
  sourceId: string;

  @ManyToOne(() => Source, (source) => source.posts, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  source: Promise<Source>;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  image?: string;

  @Column({ type: 'float', nullable: true })
  ratio?: number;

  @Column({ type: 'text', nullable: true })
  placeholder?: string;

  @Column({ type: 'text' })
  relation: string;

  @Column()
  priority: number;
}
