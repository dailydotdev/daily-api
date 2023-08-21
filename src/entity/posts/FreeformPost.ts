import { ChildEntity, Column } from 'typeorm';
import { Post, PostType } from './Post';

// Minimun content length required for new posts to trigger content-requested
export const FREEFORM_POST_MINIMUM_CONTENT_LENGTH = 1000;

// Minimun content length required for updated posts to trigger content-requested
export const FREEFORM_POST_MINIMUM_CHANGE_LENGTH = 200;

@ChildEntity(PostType.Freeform)
export class FreeformPost extends Post {
  @Column({ type: 'text', nullable: true })
  image?: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ type: 'text', nullable: true })
  contentHtml: string;
}
