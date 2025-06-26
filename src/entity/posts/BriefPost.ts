import { ChildEntity, Column } from 'typeorm';
import { Post, PostType } from './Post';

@ChildEntity(PostType.Brief)
export class BriefPost extends Post {
  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ type: 'text', nullable: true })
  contentHtml: string;

  @Column({ nullable: true })
  readTime?: number;
}
