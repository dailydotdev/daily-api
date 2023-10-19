import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import { Settings, SETTINGS_DEFAULT } from '../entity';
import { isValidHttpUrl } from '../common';
import { ValidationError } from 'apollo-server-errors';
import { v4 as uuidv4 } from 'uuid';
import { DataSource } from 'typeorm';

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
  customLinks?: string[];
}

export const typeDefs = /* GraphQL */ `
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
    Time of last update
    """
    updatedAt: DateTime!
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
    Whether the user opted out from the companion app
    """
    optOutCompanion: Boolean

    """
    Whether to automatically dismiss notifications
    """
    autoDismissNotifications: Boolean
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
    """
    Get the user settings
    """
    userSettings: Settings! @auth

    bookmarksSharing: BookmarksSharing @auth
  }
`;

type PartialBookmarkSharing = Pick<GQLBookmarksSharing, 'slug'>;

export const getSettings = async (
  con: DataSource,
  userId: string,
): Promise<Settings> => {
  try {
    const repo = con.getRepository(Settings);
    const settings = await repo.findOneBy({ userId });
    if (!settings) {
      return { ...SETTINGS_DEFAULT, updatedAt: null, userId };
    }
    return settings;
  } catch (err) {
    throw err;
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = traceResolvers({
  Mutation: {
    updateUserSettings: async (
      _,
      { data }: { data: GQLUpdateSettingsInput },
      { con, userId },
    ): Promise<GQLSettings> => {
      if (data.customLinks?.length && !data.customLinks.every(isValidHttpUrl)) {
        throw new ValidationError('One of the links is invalid');
      }

      return con.transaction(async (manager): Promise<Settings> => {
        const repo = manager.getRepository(Settings);
        const settings = await repo.findOneBy({ userId });

        if (!settings) {
          return repo.save({ ...data, userId });
        }

        return repo.save(repo.merge(settings, data));
      });
    },
    setBookmarksSharing: async (
      _,
      { enabled }: { enabled: boolean },
      { con, userId },
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

      return { slug: settings.bookmarkSlug };
    },
  },
  Query: {
    userSettings: (_, __, { con, userId }): Promise<GQLSettings> => {
      return getSettings(con, userId);
    },
    bookmarksSharing: async (_, __, ctx): Promise<PartialBookmarkSharing> => {
      const settings = await ctx.con
        .getRepository(Settings)
        .findOneBy({ userId: ctx.userId });
      return { slug: settings?.bookmarkSlug };
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
