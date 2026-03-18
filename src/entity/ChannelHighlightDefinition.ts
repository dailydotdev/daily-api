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

  @Column({ type: 'boolean', default: false })
  enabled: boolean;

  @Column({ type: 'text', default: 'shadow' })
  mode: ChannelHighlightMode;

  @Column({ type: 'smallint', default: 72 })
  candidateHorizonHours: number;

  @Column({ type: 'smallint', default: 10 })
  maxItems: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
