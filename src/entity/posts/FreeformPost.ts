import { ChildEntity, Column } from 'typeorm';
import { Post, PostType } from './Post';

// Minimum content length required for new posts to trigger content-requested
export const FREEFORM_POST_MINIMUM_CONTENT_LENGTH = 1;

// Minimum content length required for updated posts to trigger content-requested
// it is here to prevent posts processing trigger on non-content related changes
export const FREEFORM_POST_MINIMUM_CHANGE_LENGTH = 1;

@ChildEntity(PostType.Freeform)
export class FreeformPost extends Post {
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
