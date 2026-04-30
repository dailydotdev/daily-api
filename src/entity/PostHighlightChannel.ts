import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { PostHighlight } from './PostHighlight';

@Entity('post_highlight_channel')
@Index(
  'IDX_post_highlight_channel_live_channel_placedAt',
  ['channel', 'placedAt'],
  {
    where: '"retiredAt" IS NULL',
  },
)
@Index('IDX_post_highlight_channel_retiredAt', ['retiredAt'], {
  where: '"retiredAt" IS NOT NULL',
})
export class PostHighlightChannel {
  @PrimaryColumn({ type: 'uuid' })
  highlightId: string;

  @PrimaryColumn({ type: 'text' })
  channel: string;

  @Column({ type: 'timestamp' })
  placedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  retiredAt: Date | null;

  @ManyToOne(() => PostHighlight, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'highlightId' })
  highlight: Promise<PostHighlight>;
}
