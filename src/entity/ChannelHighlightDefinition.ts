import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ChannelHighlightMode } from '../common/channelHighlight/schema';

@Entity()
export class ChannelHighlightDefinition {
  @PrimaryColumn({ type: 'text' })
  channel: string;

  @Column({ type: 'text', default: 'disabled' })
  mode: ChannelHighlightMode;

  @Column({ type: 'text', default: '' })
  targetAudience: string;

  @Column({ type: 'smallint', default: 72 })
  candidateHorizonHours: number;

  @Column({ type: 'smallint', default: 10 })
  maxItems: number;

  @Column({ type: 'timestamp', nullable: true })
  lastFetchedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
