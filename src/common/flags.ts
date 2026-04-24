import type { Settings } from '../entity';

export const transformSettingFlags = ({ flags }: Pick<Settings, 'flags'>) => {
  const {
    sidebarSquadExpanded,
    sidebarCustomFeedsExpanded,
    sidebarOtherExpanded,
    sidebarResourcesExpanded,
    sidebarBookmarksExpanded,
    clickbaitShieldEnabled,
    browsingContextEnabled,
    prompt,
    timezoneMismatchIgnore,
    lastPrompt,
    defaultWriteTab,
    legacyPostLayoutOptOut,
    shortcutsMode,
    shortcutsAppearance,
    showShortcutsOnWebapp,
    shortcutMeta,
  } = flags ?? {};

  return {
    sidebarSquadExpanded: sidebarSquadExpanded ?? true,
    sidebarCustomFeedsExpanded: sidebarCustomFeedsExpanded ?? true,
    sidebarOtherExpanded: sidebarOtherExpanded ?? true,
    sidebarResourcesExpanded: sidebarResourcesExpanded ?? true,
    sidebarBookmarksExpanded: sidebarBookmarksExpanded ?? true,
    clickbaitShieldEnabled: clickbaitShieldEnabled ?? true,
    browsingContextEnabled: browsingContextEnabled ?? false,
    prompt,
    timezoneMismatchIgnore,
    lastPrompt,
    defaultWriteTab,
    legacyPostLayoutOptOut: legacyPostLayoutOptOut ?? false,
    shortcutsMode,
    shortcutsAppearance,
    showShortcutsOnWebapp,
    shortcutMeta,
  };
};
