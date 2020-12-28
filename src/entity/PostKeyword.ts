import { Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { Post } from './Post';

@Entity()
export class PostKeyword {
  @PrimaryColumn({ type: 'text' })
  @Index('IDX_post_keyword_postId')
  postId: string;

  @PrimaryColumn({ type: 'text' })
  @Index('IDX_post_keyword_keyword')
  keyword: string;

  @ManyToOne(() => Post, (post) => post.keywords, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  post: Promise<Post>;
}
