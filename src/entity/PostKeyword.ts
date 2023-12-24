import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { Post } from './posts';

@Entity()
@Index('IDX_post_keyword_postId_status', ['postId', 'status'])
@Index('IDX_post_keyword_keyword_postid', ['keyword', 'postId'])
export class PostKeyword {
  @PrimaryColumn({ type: 'text' })
  @Index('IDX_post_keyword_postId')
  postId: string;

  @PrimaryColumn({ type: 'text' })
  @Index('IDX_post_keyword_keyword')
  keyword: string;

  @Column({ type: 'text', nullable: true })
  status: string;

  @ManyToOne(() => Post, (post) => post.keywords, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  post: Promise<Post>;
}
