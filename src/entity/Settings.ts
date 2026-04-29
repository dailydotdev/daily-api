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

export enum DefaultWriteTab {
  Share = 'Share',
  NewPost = 'NewPost',
  Poll = 'Poll',
}

export enum NewTabMode {
  Discover = 'discover',
  Focus = 'focus',
}

export type FocusScheduleWindow = {
  start: number;
  end: number;
  enabled: boolean;
};

export type FocusSchedule = {
  pauseUntil?: number | null;
  windows?: Partial<Record<string, FocusScheduleWindow | null>>;
};

export type SettingsFlags = Partial<{
  sidebarSquadExpanded: boolean;
  sidebarCustomFeedsExpanded: boolean;
  sidebarOtherExpanded: boolean;
  sidebarResourcesExpanded: boolean;
  sidebarBookmarksExpanded: boolean;
  clickbaitShieldEnabled: boolean;
  browsingContextEnabled: boolean;
  prompt: object;
  timezoneMismatchIgnore: string;
  lastPrompt: string;
  defaultWriteTab: DefaultWriteTab;
  legacyPostLayoutOptOut: boolean;
  newTabMode: NewTabMode;
  focusSchedule: FocusSchedule;
}>;

export type SettingsFlagsPublic = Pick<
  SettingsFlags,
  | 'sidebarSquadExpanded'
  | 'sidebarCustomFeedsExpanded'
  | 'sidebarOtherExpanded'
  | 'sidebarResourcesExpanded'
  | 'sidebarBookmarksExpanded'
  | 'clickbaitShieldEnabled'
  | 'browsingContextEnabled'
  | 'prompt'
  | 'timezoneMismatchIgnore'
  | 'lastPrompt'
  | 'defaultWriteTab'
  | 'legacyPostLayoutOptOut'
  | 'newTabMode'
  | 'focusSchedule'
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
  optOutLevelSystem: boolean;

  @Column({ default: false })
  optOutQuestSystem: boolean;

  // Companion is opt-in — it requires the broad host permission to inject
  // a side panel into every article page. Default to off so new users
  // get a clean feed; the customize sidebar's Widgets toggle is the
  // canonical entry point to enable it.
  @Column({ default: true })
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

  @Column({ default: true })
  showFeedbackButton: boolean;

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
  showTopSites: true,
  insaneMode: false,
  spaciness: 'eco',
  showOnlyUnreadPosts: false,
  openNewTab: true,
  sidebarExpanded: false,
  companionExpanded: false,
  autoDismissNotifications: true,
  customLinks: null,
  optOutCompanion: true,
  optOutWeeklyGoal: false,
  optOutReadingStreak: false,
  optOutLevelSystem: false,
  optOutQuestSystem: false,
  sortingEnabled: false,
  sortCommentsBy: SortCommentsBy.OldestFirst,
  campaignCtaPlacement: CampaignCtaPlacement.Header,
  onboardingChecklistView: ChecklistViewState.Hidden,
  showFeedbackButton: true,
  flags: {
    sidebarSquadExpanded: true,
    sidebarCustomFeedsExpanded: true,
    sidebarOtherExpanded: true,
    sidebarResourcesExpanded: true,
    sidebarBookmarksExpanded: true,
    clickbaitShieldEnabled: true,
    defaultWriteTab: DefaultWriteTab.NewPost,
  },
};
