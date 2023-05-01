import { ChildEntity, Column } from 'typeorm';
import { Post, PostType } from './Post';

@ChildEntity(PostType.Freeform)
export class FreeformPost extends Post {
  @Column({ type: 'text', nullable: true })
  image?: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ type: 'text', nullable: true })
  contentHtml: string;
}
