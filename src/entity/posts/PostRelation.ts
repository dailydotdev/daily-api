import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import type { Post } from './Post';

export enum PostRelationType {
  Collection = 'COLLECTION',
}

@Entity()
@Index('IDX_post_relation_post_id_related_post_id_type_created_at', [
  'postId',
  'relatedPostId',
  'type',
  'createdAt',
])
export class PostRelation {
  @PrimaryColumn({ type: 'text' })
  postId: string;

  @PrimaryColumn({ type: 'text' })
  relatedPostId: string;

  @PrimaryColumn({ type: 'text', default: PostRelationType.Collection })
  type: PostRelationType;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @ManyToOne('Post', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  post: Promise<Post>;

  @ManyToOne('Post', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  relatedPost: Promise<Post>;
}
