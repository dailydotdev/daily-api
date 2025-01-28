import { Column, Entity, Index, OneToOne, PrimaryColumn } from 'typeorm';
import type { User } from './user';

export type AlertsFlags = Partial<{
  lastReferralReminder: Date | null;
}>;

@Entity()
@Index('IDX_alerts_flags_last_referral_reminder', {
  synchronize: false,
})
export class Alerts {
  @PrimaryColumn({ type: 'text' })
  @Index()
  userId: string;

  @Column({ type: 'bool', default: true })
  filter: boolean;

  @Column({ type: 'timestamp without time zone', default: null })
  rankLastSeen: Date | null;

  @Column({ type: 'text', default: null })
  myFeed: string | null;

  @Column({ type: 'bool', default: true })
  companionHelper: boolean;

  @Column({ type: 'bool', default: true })
  squadTour: boolean;

  @Column({ type: 'bool', default: false })
  showGenericReferral: boolean;

  @Column({ type: 'timestamp without time zone', default: () => 'now()' })
  lastChangelog: Date | null;

  @Column({ type: 'timestamp without time zone', default: () => 'now()' })
  lastBanner: Date | null;

  @Column({ type: 'timestamp without time zone', default: null })
  lastBootPopup: Date | null;

  @Column({ type: 'bool', default: false })
  showStreakMilestone: boolean;

  @Column({ type: 'bool', default: false })
  showRecoverStreak: boolean;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  lastFeedSettingsFeedback: Date;

  // Should not be exposed to the client
  @Column({ type: 'jsonb', default: {} })
  flags: AlertsFlags = {};

  changelog?: boolean;

  banner?: boolean;

  bootPopup?: boolean;

  @Column({ type: 'bool', default: false })
  showTopReader?: boolean;

  @OneToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}

export const ALERTS_DEFAULT: Omit<Alerts, 'userId' | 'flags' | 'user'> = {
  filter: true,
  rankLastSeen: null,
  myFeed: null,
  companionHelper: true,
  lastChangelog: new Date(),
  lastBanner: new Date(),
  changelog: false,
  banner: false,
  squadTour: true,
  lastFeedSettingsFeedback: new Date(),
  showGenericReferral: false,
  showStreakMilestone: false,
  lastBootPopup: null,
  bootPopup: false,
  showRecoverStreak: false,
  showTopReader: false,
};
