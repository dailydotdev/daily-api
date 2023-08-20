import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity()
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

  @Column({ type: 'timestamp without time zone', default: () => 'now()' })
  lastChangelog: Date | null;

  @Column({ type: 'timestamp without time zone', default: () => 'now()' })
  lastBanner: Date | null;

  changelog?: boolean;

  banner?: boolean;
}

export const ALERTS_DEFAULT: Omit<Alerts, 'userId'> = {
  filter: true,
  rankLastSeen: null,
  myFeed: null,
  companionHelper: true,
  lastChangelog: new Date(),
  lastBanner: new Date(),
  changelog: false,
  banner: false,
  squadTour: true,
};
