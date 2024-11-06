import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Post, PostType } from './posts';
import type { Source } from './Source';
import type { User } from './user';

export enum SourcePostModerationStatus {
  Approved = 'approved',
  Rejected = 'rejected',
  Pending = 'pending',
}

@Entity()
export class SourcePostModeration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  sourceId: string;

  @ManyToOne('Source', (source: Source) => source.id, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  source: Promise<Source>;

  @Column({ type: 'text' })
  status: SourcePostModerationStatus;

  @Column({ type: 'text' })
  createdById: string;

  @ManyToOne('User', (user: User) => user.id, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  createdBy: Promise<User>;

  @Column({ type: 'text', nullable: true })
  moderatedById: string | null;

  @ManyToOne('User', (user: User) => user.id, {
    lazy: true,
    onDelete: 'SET NULL',
  })
  moderatedBy: Promise<User>;

  @Column({ type: 'text', nullable: true })
  moderatorMessage: string | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

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
  type: PostType;

  @Column({ type: 'text', nullable: true })
  title?: string | null;

  @Column({ type: 'text', nullable: true })
  titleHtml?: string | null;

  @Column({ type: 'text', nullable: true })
  content?: string | null;

  @Column({ type: 'text', nullable: true })
  contentHtml: string | null;

  @Column({ type: 'text', nullable: true })
  image?: string | null;

  @Column({ type: 'text', nullable: true })
  sharedPostId?: string | null;

  @ManyToOne('Post', (post: Post) => post.id, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  sharedPost?: Promise<Post>;

  @Column({ type: 'text', nullable: true })
  externalLink?: string | null;
}
