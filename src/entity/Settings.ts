import {
  Column,
  Entity,
  Index,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user';

export enum CampaignCtaPlacement {
  Header = 'header',
  ProfileMenu = 'profileMenu',
}

@Entity()
export class Settings {
  @PrimaryColumn({ type: 'text' })
  userId: string;

  @Column({ type: 'text', default: 'darcula' })
  theme: string;

  @Column({ default: true })
  showTopSites: boolean;

  @Column({ default: false })
  insaneMode: boolean;

  @Column({ type: 'text', default: 'eco' })
  spaciness: string;

  @Column({ default: false })
  showOnlyUnreadPosts: boolean;

  @Column({ default: true })
  openNewTab: boolean;

  @Column({ default: false })
  sidebarExpanded: boolean;

  @Column({ default: null })
  companionExpanded: boolean;

  @Column({ default: false })
  sortingEnabled: boolean;

  @Column({ type: 'uuid', default: null })
  @Index('IDX_settings_bookmarkslug', { unique: true })
  bookmarkSlug?: string | null;

  @Column({ default: false })
  optOutWeeklyGoal: boolean;

  @Column({ default: false })
  optOutReadingStreak: boolean;

  @Column({ default: false })
  optOutCompanion: boolean;

  @Column({ type: 'text', array: true, default: null })
  customLinks: string[];

  @Column({ default: true })
  autoDismissNotifications: boolean;

  @Column({ type: 'text', default: CampaignCtaPlacement.Header })
  campaignCtaPlacement: CampaignCtaPlacement | null;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => User, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}

export const SETTINGS_DEFAULT = {
  theme: 'darcula',
  showTopSites: true,
  insaneMode: false,
  spaciness: 'eco',
  showOnlyUnreadPosts: false,
  openNewTab: true,
  sidebarExpanded: false,
  companionExpanded: false,
  autoDismissNotifications: true,
  customLinks: null,
  optOutCompanion: false,
  optOutWeeklyGoal: false,
  optOutReadingStreak: false,
  sortingEnabled: false,
  campaignCtaPlacement: CampaignCtaPlacement.Header,
};
