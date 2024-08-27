import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import type { AdvancedSettings } from './AdvancedSettings';
import type { Feed } from './Feed';

@Entity()
export class FeedAdvancedSettings {
  @PrimaryColumn({ type: 'text' })
  @Index('IDX_feed_advanced_settings_feedId')
  feedId: string;

  @PrimaryColumn({ type: 'int' })
  advancedSettingsId: number;

  @Column({ type: 'bool', default: true })
  enabled: boolean;

  @ManyToOne('Feed', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  feed: Promise<Feed>;

  @ManyToOne('AdvancedSettings', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  advancedSettings: Promise<AdvancedSettings>;
}
