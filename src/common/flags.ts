import { HighlightsPlacement, type Settings } from '../entity';

export const transformSettingFlags = ({ flags }: Pick<Settings, 'flags'>) => {
  const {
    sidebarSquadExpanded,
    sidebarCustomFeedsExpanded,
    sidebarOtherExpanded,
    sidebarResourcesExpanded,
    sidebarBookmarksExpanded,
    clickbaitShieldEnabled,
    browsingContextEnabled,
    highlightsPlacement,
    prompt,
    timezoneMismatchIgnore,
    lastPrompt,
    defaultWriteTab,
    legacyPostLayoutOptOut,
    readerInstallPromptAcknowledged,
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
    highlightsPlacement: highlightsPlacement ?? HighlightsPlacement.Default,
    prompt,
    timezoneMismatchIgnore,
    lastPrompt,
    defaultWriteTab,
    legacyPostLayoutOptOut: legacyPostLayoutOptOut ?? false,
    readerInstallPromptAcknowledged: readerInstallPromptAcknowledged ?? false,
    shortcutsMode,
    shortcutsAppearance,
    showShortcutsOnWebapp,
    shortcutMeta,
  };
};
