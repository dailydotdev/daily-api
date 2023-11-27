import { ChildEntity, Column } from 'typeorm';
import { Post, PostType } from './Post';

@ChildEntity(PostType.VideoYouTube)
export class YouTubePost extends Post {
  @Column({ type: 'text', nullable: true })
  image?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  summary?: string;

  @Column({ type: 'integer', nullable: true })
  readTime?: number;

  @Column({ type: 'text' })
  video_id: string;
}
