import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Post, PostType } from './posts';
import { Source } from './Source';

export enum SquadPostModerationStatus {
  Approved = 'approved',
  Rejected = 'rejected',
  Pending = 'pending',
}

@Entity()
export class SquadPostModeration {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ type: 'text' })
  sourceId: string;

  @ManyToOne('Source', (source: Source) => source.id, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  source: Promise<Source>;

  @Column({
    type: 'enum',
    enum: SquadPostModerationStatus,
    default: SquadPostModerationStatus.Pending,
  })
  status: SquadPostModerationStatus;

  @Column({ type: 'text' })
  createdById: string;

  @Column({ type: 'text', nullable: true })
  moderatedById: string | null;

  @Column({ type: 'text', nullable: true })
  moderatorMessage: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'text', nullable: true })
  postId: string | null;

  @ManyToOne('Post', (post: Post) => post.id, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  post: Promise<Post>;

  @Column({ type: 'text' })
  type: PostType.Share | PostType.Freeform | PostType.Article;

  @Column({ type: 'text', nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  titleHtml: string | null;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ type: 'text', nullable: true })
  contentHtml: string | null;

  @Column({ type: 'text', nullable: true })
  image: string | null;

  @Column({ type: 'text', nullable: true })
  sharedPostId: string | null;
}
