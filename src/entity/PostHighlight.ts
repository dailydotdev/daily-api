import {
  Column,
  Entity,
  Index,
  CreateDateColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Post } from './posts/Post';

export enum PostHighlightSignificance {
  Unspecified = 0,
  Breaking = 1,
  Major = 2,
  Notable = 3,
  Routine = 4,
}

export const toPostHighlightSignificance = (
  label: string | null | undefined,
): PostHighlightSignificance => {
  switch ((label || '').toLowerCase()) {
    case 'breaking':
      return PostHighlightSignificance.Breaking;
    case 'major':
      return PostHighlightSignificance.Major;
    case 'notable':
      return PostHighlightSignificance.Notable;
    case 'routine':
      return PostHighlightSignificance.Routine;
    default:
      return PostHighlightSignificance.Unspecified;
  }
};

export const toPostHighlightSignificanceLabel = (
  significance: PostHighlightSignificance | null | undefined,
): string | null => {
  switch (significance) {
    case PostHighlightSignificance.Breaking:
      return 'breaking';
    case PostHighlightSignificance.Major:
      return 'major';
    case PostHighlightSignificance.Notable:
      return 'notable';
    case PostHighlightSignificance.Routine:
      return 'routine';
    default:
      return null;
  }
};

@Entity()
@Index(
  'IDX_post_highlight_active_channel_highlightedAt',
  ['channel', 'highlightedAt'],
  {
    where: '"retiredAt" IS NULL',
  },
)
@Index('UQ_post_highlight_channel_post', ['channel', 'postId'], {
  unique: true,
})
@Index('IDX_post_highlight_retiredAt', ['retiredAt'], {
  where: '"retiredAt" IS NOT NULL',
})
export class PostHighlight {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  channel: string;

  @Column({ type: 'text' })
  @Index('IDX_post_highlight_post')
  postId: string;

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

  @Column({ type: 'timestamp', nullable: true })
  retiredAt: Date | null;

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
