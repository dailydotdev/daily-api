import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export const channelDigestFrequencies = ['daily', 'weekly'] as const;

export type ChannelDigestFrequency = (typeof channelDigestFrequencies)[number];

@Entity()
export class ChannelDigest {
  @PrimaryColumn({ type: 'text' })
  key: string;

  @Column({ type: 'text' })
  sourceId: string;

  @Column({ type: 'text' })
  channel: string;

  @Column({ type: 'text' })
  targetAudience: string;

  @Column({ type: 'text' })
  frequency: ChannelDigestFrequency;

  @Column({ type: 'boolean', default: false })
  includeSentiment: boolean;

  @Column({ type: 'real', nullable: true })
  minHighlightScore: number | null;

  @Column({ type: 'text', array: true, default: [] })
  sentimentGroupIds: string[];

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
