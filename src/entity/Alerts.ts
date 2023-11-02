import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

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
  myFeed: string;

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

  // Should not be exposed to the client
  @Column({ type: 'jsonb', default: {}, select: false })
  flags: AlertsFlags = {};

  changelog?: boolean;

  banner?: boolean;
}

export const ALERTS_DEFAULT: Omit<Alerts, 'userId' | 'flags'> = {
  filter: true,
  rankLastSeen: null,
  myFeed: null,
  companionHelper: true,
  lastChangelog: new Date(),
  lastBanner: new Date('2023-02-05 12:00:00'), // Has to be in the past to accommodate new users
  changelog: false,
  banner: false,
  squadTour: true,
  showGenericReferral: false,
};
