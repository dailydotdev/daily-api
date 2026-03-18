import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { ChannelHighlightCandidatePool } from '../common/channelHighlight/schema';

@Entity()
export class ChannelHighlightState {
  @PrimaryColumn({ type: 'text' })
  channel: string;

  @Column({ type: 'timestamp', nullable: true })
  lastFetchedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastPublishedAt: Date | null;

  @Column({ type: 'jsonb', default: () => `'{"stories":[]}'::jsonb` })
  candidatePool: ChannelHighlightCandidatePool;

  @UpdateDateColumn()
  updatedAt: Date;
}
