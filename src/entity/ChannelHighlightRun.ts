import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
@Index('IDX_channel_highlight_run_channel_scheduledAt', [
  'channel',
  'scheduledAt',
])
export class ChannelHighlightRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  channel: string;

  @Column({ type: 'timestamp' })
  scheduledAt: Date;

  @CreateDateColumn()
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'text' })
  status: string;

  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` })
  baselineSnapshot: object[];

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  inputSummary: object;

  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` })
  internalSnapshot: object[];

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  comparison: object;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  metrics: object;

  @Column({ type: 'jsonb', nullable: true })
  error: object | null;
}
