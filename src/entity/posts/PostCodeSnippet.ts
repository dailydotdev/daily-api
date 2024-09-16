import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { PostCodeSnippetLanguage } from '../../types';
import type { Post } from './Post';

@Entity()
export class PostCodeSnippet {
  @PrimaryColumn({ type: 'text' })
  postId: string;

  @PrimaryColumn({ type: 'text' })
  contentHash: string;

  @Index()
  @Column({ type: 'integer' })
  order: number;

  @Column({ type: 'text', default: PostCodeSnippetLanguage.Plain })
  language: PostCodeSnippetLanguage;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'text' })
  content: string;

  @ManyToOne('Post', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  post: Promise<Post>;
}
