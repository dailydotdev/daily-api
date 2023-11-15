import { ChildEntity, Column } from 'typeorm';
import { Post, PostType } from './Post';

@ChildEntity(PostType.Collection)
export class CollectionPost extends Post {
  @Column({ type: 'text', nullable: true })
  image?: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ type: 'text', nullable: true })
  contentHtml: string;

  @Column({ nullable: true })
  readTime?: number;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  summary?: string;
}
