import {
  Column,
  Entity,
  Index,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from './user';
import { SortCommentsBy } from '../schema/comments';

export enum CampaignCtaPlacement {
  Header = 'header',
  ProfileMenu = 'profileMenu',
}

export enum ChecklistViewState {
  Open = 'open',
  Closed = 'closed',
  Hidden = 'hidden',
}

export type SettingsFlags = Partial<{
  sidebarSquadExpanded: boolean;
  sidebarCustomFeedsExpanded: boolean;
  sidebarOtherExpanded: boolean;
  sidebarResourcesExpanded: boolean;
  sidebarBookmarksExpanded: boolean;
  clickbaitShieldEnabled: boolean;
  prompt: object;
  timezoneMismatchIgnore: string;
  lastPrompt: string;
}>;

export type SettingsFlagsPublic = Pick<
  SettingsFlags,
  | 'sidebarSquadExpanded'
  | 'sidebarCustomFeedsExpanded'
  | 'sidebarOtherExpanded'
  | 'sidebarResourcesExpanded'
  | 'sidebarBookmarksExpanded'
  | 'clickbaitShieldEnabled'
  | 'prompt'
  | 'timezoneMismatchIgnore'
  | 'lastPrompt'
>;

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

  @Column({ type: 'text', default: SortCommentsBy.OldestFirst })
  sortCommentsBy: SortCommentsBy;

  @Column({ type: 'text', array: true, default: null })
  customLinks: string[] | null;

  @Column({ default: true })
  autoDismissNotifications: boolean;

  @Column({ type: 'text', default: CampaignCtaPlacement.Header })
  campaignCtaPlacement: CampaignCtaPlacement | null;

  @Column({ type: 'text', default: ChecklistViewState.Hidden })
  onboardingChecklistView: ChecklistViewState;

  @UpdateDateColumn()
  updatedAt: Date | null;

  @Column({ type: 'jsonb', default: {} })
  flags: SettingsFlags = {};

  @OneToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}

export const SETTINGS_DEFAULT = {
  theme: 'darcula',
  recruiterTheme: 'bright',
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
  sortCommentsBy: SortCommentsBy.OldestFirst,
  campaignCtaPlacement: CampaignCtaPlacement.Header,
  onboardingChecklistView: ChecklistViewState.Hidden,
  flags: {
    sidebarSquadExpanded: true,
    sidebarCustomFeedsExpanded: true,
    sidebarOtherExpanded: true,
    sidebarResourcesExpanded: true,
    sidebarBookmarksExpanded: true,
    clickbaitShieldEnabled: true,
  },
};
