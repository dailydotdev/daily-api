import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class ChannelHighlightState {
  @PrimaryColumn({ type: 'text' })
  channel: string;

  @Column({ type: 'timestamp', nullable: true })
  lastFetchedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastPublishedAt: Date | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
