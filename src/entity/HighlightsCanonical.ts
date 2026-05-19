import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Post } from './posts/Post';
import { PostHighlightSignificance } from './PostHighlight';

@Entity()
@Index('UQ_highlights_canonical_post', ['postId'], {
  unique: true,
})
@Index('IDX_highlights_canonical_highlightedAt', ['highlightedAt'])
@Index('IDX_highlights_canonical_channels', {
  synchronize: false,
})
export class HighlightsCanonical {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  postId: string;

  @Column({ type: 'text', array: true, default: () => `'{}'::text[]` })
  channels: string[];

  @Column({ type: 'timestamp' })
  highlightedAt: Date;

  @Column({ type: 'text' })
  headline: string;

  @Column({
    type: 'smallint',
    default: PostHighlightSignificance.Unspecified,
  })
  significance: PostHighlightSignificance;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne('Post', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  post: Promise<Post>;
}
