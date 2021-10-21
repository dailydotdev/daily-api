import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { AdvancedSettings } from './AdvancedSettings';
import { Feed } from './Feed';

@Entity()
export class FeedAdvancedSettings {
  @PrimaryColumn({ type: 'text' })
  @Index()
  feedId: string;

  @PrimaryColumn({ type: 'text' })
  advancedSettingsId: string;

  @Column({ type: 'bool', default: true })
  enabled: boolean;

  @ManyToOne(() => Feed, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  feed: Promise<Feed>;

  @ManyToOne(() => AdvancedSettings, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  advancedSettings: Promise<AdvancedSettings>;
}
