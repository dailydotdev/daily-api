import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { AuthContext, BaseContext } from '../Context';
import {
  CampaignCtaPlacement,
  ChecklistViewState,
  DefaultWriteTab,
  Settings,
  SETTINGS_DEFAULT,
  SettingsFlagsPublic,
} from '../entity';
import { isValidHttpUrl, toGQLEnum, updateFlagsStatement } from '../common';
import { ValidationError } from 'apollo-server-errors';
import { v4 as uuidv4 } from 'uuid';
import { DataSource, QueryRunner } from 'typeorm';
import { transformSettingFlags } from '../common/flags';
import { z } from 'zod';

interface GQLSettings {
  userId: string;
  theme: string;
  showTopSites: boolean;
  insaneMode: boolean;
  spaciness: string;
  showOnlyUnreadPosts: boolean;
  openNewTab: boolean;
  sidebarExpanded: boolean;
  companionExpanded: boolean;
  sortingEnabled: boolean;
  autoDismissNotifications: boolean;
  updatedAt: Date;
  optOutReadingStreak: boolean;
  flags?: SettingsFlagsPublic;
}

interface GQLBookmarksSharing {
  enabled: boolean;
  slug: string | null;
  rssUrl: string | null;
}

interface GQLUpdateSettingsInput extends Partial<GQLSettings> {
  theme?: string;
  showTopSites?: boolean;
  insaneMode?: boolean;
  spaciness?: string;
  showOnlyUnreadPosts?: boolean;
  openNewTab?: boolean;
  sidebarExpanded?: boolean;
  companionExpanded?: boolean;
  sortingEnabled?: boolean;
  autoDismissNotifications?: boolean;
  campaignCtaPlacement?: CampaignCtaPlacement;
  customLinks?: string[];
  optOutReadingStreak?: boolean;
  defaultWriteTab?: DefaultWriteTab;
}

export const typeDefs = /* GraphQL */ `
  ${toGQLEnum(ChecklistViewState, 'ChecklistViewState')}
  ${toGQLEnum(DefaultWriteTab, 'DefaultWriteTab')}

  type SettingsFlagsPublic {
    sidebarSquadExpanded: Boolean
    sidebarCustomFeedsExpanded: Boolean
    sidebarOtherExpanded: Boolean
    sidebarResourcesExpanded: Boolean
    sidebarBookmarksExpanded: Boolean
    clickbaitShieldEnabled: Boolean
    timezoneMismatchIgnore: String
    lastPrompt: String
    defaultWriteTab: DefaultWriteTab
  }

  input SettingsFlagsPublicInput {
    sidebarSquadExpanded: Boolean
    sidebarCustomFeedsExpanded: Boolean
    sidebarOtherExpanded: Boolean
    sidebarResourcesExpanded: Boolean
    sidebarBookmarksExpanded: Boolean
    clickbaitShieldEnabled: Boolean
    prompt: JSONObject
    timezoneMismatchIgnore: String
    lastPrompt: String
    defaultWriteTab: DefaultWriteTab
  }

  """
  User personal preferences
  """
  type Settings {
    """
    Id of the user who requested this source
    """
    userId: ID!

    """
    Preferred theme
    """
    theme: String!

    """
    Whether to enable card animations
    """
    enableCardAnimations: Boolean!

    """
    Whether to show top sites for quick navigation
    """
    showTopSites: Boolean!

    """
    Whether to enable insane mode
    """
    insaneMode: Boolean!

    """
    Whether to enable insane mode for Daily Go
    """
    appInsaneMode: Boolean!

    """
    Spaciness level for the layout
    """
    spaciness: String!

    """
    Whether to show unread posts only
    """
    showOnlyUnreadPosts: Boolean!

    """
    Whether to open articles on new tab
    """
    openNewTab: Boolean!

    """
    Whether to show the sidebar in expanded form
    """
    sidebarExpanded: Boolean!

    """
    Whether to show the companion in expanded form
    """
    companionExpanded: Boolean

    """
    Whether to allow sorting of the feeds
    """
    sortingEnabled: Boolean!

    """
    Custom links that the user has defined for their extension shortcut links
    """
    customLinks: [String]

    """
    Whether the user opted out from the weekly goal
    """
    optOutWeeklyGoal: Boolean!

    """
    Whether the user opted out from reading streak
    """
    optOutReadingStreak: Boolean!

    """
    Whether the user opted out from the companion app
    """
    optOutCompanion: Boolean!

    """
    Whether to automatically dismiss notifications
    """
    autoDismissNotifications: Boolean!

    """
    Which campaign to use for as the main CTA
    """
    campaignCtaPlacement: String

    """
    State of the onboarding checklist
    """
    onboardingChecklistView: ChecklistViewState

    """
    Selected algorithm by the user for comments section
    """
    sortCommentsBy: SortCommentsBy

    """
    Time of last update
    """
    updatedAt: DateTime!

    """
    Flags for the settings
    """
    flags: SettingsFlagsPublic
  }

  type BookmarksSharing {
    enabled: Boolean!
    slug: String
    rssUrl: String
  }

  input UpdateSettingsInput {
    """
    Preferred theme
    """
    theme: String

    """
    Whether to enable card animations
    """
    enableCardAnimations: Boolean

    """
    Whether to show top sites for quick navigation
    """
    showTopSites: Boolean

    """
    Whether to enable insane mode
    """
    insaneMode: Boolean

    """
    Whether to enable insane mode for Daily Go
    """
    appInsaneMode: Boolean

    """
    Spaciness level for the layout
    """
    spaciness: String

    """
    Whether to show unread posts only
    """
    showOnlyUnreadPosts: Boolean

    """
    Whether to open articles on new tab
    """
    openNewTab: Boolean

    """
    Whether to show the sidebar in expanded form
    """
    sidebarExpanded: Boolean

    """
    Whether to show the companion in expanded form
    """
    companionExpanded: Boolean

    """
    Whether to allow sorting of the feeds
    """
    sortingEnabled: Boolean

    """
    Custom links that the user has defined for their extension shortcut links
    """
    customLinks: [String]

    """
    Whether the user opted out from the weekly goal
    """
    optOutWeeklyGoal: Boolean

    """
    Whether the user opted out from reading streak
    """
    optOutReadingStreak: Boolean

    """
    Whether the user opted out from the companion app
    """
    optOutCompanion: Boolean

    """
    Whether to automatically dismiss notifications
    """
    autoDismissNotifications: Boolean

    """
    Which campaign to use for as the main CTA
    """
    campaignCtaPlacement: String

    """
    State of the onboarding checklist
    """
    onboardingChecklistView: ChecklistViewState

    """
    Selected algorithm by the user for comments section
    """
    sortCommentsBy: SortCommentsBy

    """
    Flags for the settings
    """
    flags: SettingsFlagsPublicInput
  }

  extend type Mutation {
    """
    Update the user settings
    """
    updateUserSettings(data: UpdateSettingsInput!): Settings! @auth

    """
    Enable/disable the bookmarks sharing
    """
    setBookmarksSharing(enabled: Boolean!): BookmarksSharing @auth
  }

  extend type Query {
    bookmarksSharing: BookmarksSharing @auth
  }
`;

type PartialBookmarkSharing = Pick<GQLBookmarksSharing, 'slug'>;

export const getSettings = async (
  con: DataSource | QueryRunner,
  userId: string,
): Promise<Settings | Omit<Settings, 'user'>> => {
  try {
    const repo = con.manager.getRepository(Settings);
    const settings = await repo.findOneBy({ userId });
    if (!settings) {
      return {
        ...SETTINGS_DEFAULT,
        updatedAt: null,
        userId,
      };
    }

    return {
      ...settings,
      flags: transformSettingFlags({ flags: settings.flags }),
    };
  } catch (err) {
    throw err;
  }
};

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Mutation: {
    updateUserSettings: async (
      _,
      { data }: { data: GQLUpdateSettingsInput },
      { con, userId }: AuthContext,
    ): Promise<Settings> => {
      if (data.customLinks?.length && !data.customLinks.every(isValidHttpUrl)) {
        throw new ValidationError('One of the links is invalid');
      }

      if (
        data.campaignCtaPlacement &&
        !Object.values(CampaignCtaPlacement).includes(data.campaignCtaPlacement)
      ) {
        throw new ValidationError(`Invalid value for 'campaignCtaPlacement'`);
      }

      if (
        data?.flags?.defaultWriteTab &&
        !Object.values(DefaultWriteTab).includes(data.flags.defaultWriteTab)
      ) {
        throw new ValidationError(`Invalid value for 'defaultWriteTab'`);
      }

      const promptSchema = z.record(z.string(), z.boolean());
      const result = promptSchema.safeParse(data.flags?.prompt);

      if (!!data.flags?.prompt && !result.success) {
        throw new ValidationError('Invalid value for prompt');
      }

      return con.transaction(async (manager): Promise<Settings> => {
        const repo = manager.getRepository(Settings);
        const settings = await repo.findOneBy({ userId });

        const dataWithAdjustedFlags = {
          ...data,
          flags: updateFlagsStatement<Settings>(data?.flags || {}),
        };

        if (!settings) {
          return repo.save({
            ...data,
            userId,
          });
        }

        await repo.update({ userId }, dataWithAdjustedFlags);
        return {
          ...settings,
          ...data,
          flags: { ...settings.flags, ...data.flags },
        };
      });
    },
    setBookmarksSharing: async (
      _,
      { enabled }: { enabled: boolean },
      { con, userId }: AuthContext,
    ): Promise<PartialBookmarkSharing> => {
      const settings = await con.transaction(
        async (manager): Promise<Settings> => {
          const repo = manager.getRepository(Settings);
          const settings = await repo.findOneBy({ userId });
          const bookmarkSlug = enabled ? uuidv4() : null;

          if (!settings) {
            return repo.save({ userId, bookmarkSlug });
          }

          if (!!settings.bookmarkSlug === enabled) {
            return settings;
          }

          return repo.save(repo.merge(settings, { bookmarkSlug }));
        },
      );

      return { slug: settings.bookmarkSlug || null };
    },
  },
  Query: {
    bookmarksSharing: async (
      _,
      __,
      ctx: AuthContext,
    ): Promise<PartialBookmarkSharing> => {
      const settings = await ctx.con
        .getRepository(Settings)
        .findOneBy({ userId: ctx.userId });
      return { slug: settings?.bookmarkSlug || null };
    },
  },
  Settings: {
    appInsaneMode: () => true,
    enableCardAnimations: () => true,
  },
  BookmarksSharing: {
    enabled: (obj: PartialBookmarkSharing) => !!obj.slug,
    rssUrl: (obj: PartialBookmarkSharing) =>
      obj.slug && `${process.env.URL_PREFIX}/rss/b/${obj.slug}`,
  },
});
