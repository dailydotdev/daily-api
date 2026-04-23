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

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
