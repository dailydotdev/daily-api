import { IResolvers } from 'graphql-tools';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import { Settings } from '../entity';
import { isValidHttpUrl } from '../common';
import { ValidationError } from 'apollo-server-errors';
import { EntityManager } from 'typeorm';

interface GQLSettings {
  userId: string;
  theme: string;
  showTopSites: boolean;
  insaneMode: boolean;
  spaciness: string;
  showOnlyUnreadPosts: boolean;
  openNewTab: boolean;
  sidebarExpanded: boolean;
  sortingEnabled: boolean;
  updatedAt: Date;
}

interface GQLUpdateSettingsInput extends Partial<GQLSettings> {
  theme?: string;
  showTopSites?: boolean;
  insaneMode?: boolean;
  spaciness?: string;
  showOnlyUnreadPosts?: boolean;
  openNewTab?: boolean;
  sidebarExpanded?: boolean;
  sortingEnabled?: boolean;
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
    Whether to allow sorting of the feeds
    """
    sortingEnabled: Boolean!

    """
    Custom links that the user has defined for their extension shortcut links
    """
    customLinks: [String]

    """
    Time of last update
    """
    updatedAt: DateTime!
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
    Whether to allow sorting of the feeds
    """
    sortingEnabled: Boolean

    """
    Custom links that the user has defined for their extension shortcut links
    """
    customLinks: [String]
  }

  extend type Mutation {
    """
    Update the user settings
    """
    updateUserSettings(data: UpdateSettingsInput!): Settings! @auth

    """
    Update the user's custom links
    """
    updateCustomLinks(links: [String]): Settings! @auth
  }

  extend type Query {
    """
    Get the user settings
    """
    userSettings: Settings! @auth
  }
`;

const getOrCreateSettings = async (
  manager: EntityManager,
  userId: string,
): Promise<Settings> => {
  const repo = manager.getRepository(Settings);
  const settings = await repo.findOne(userId);

  if (!settings) {
    return repo.save({ userId });
  }

  return settings;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = traceResolvers({
  Mutation: {
    updateUserSettings: async (
      _,
      { data }: { data: GQLUpdateSettingsInput },
      ctx,
    ): Promise<GQLSettings> => {
      if (data.customLinks?.length && !data.customLinks.every(isValidHttpUrl)) {
        throw new ValidationError('One of the links is invalid');
      }

      return ctx.con.transaction(async (manager): Promise<Settings> => {
        const repo = manager.getRepository(Settings);
        const settings = await getOrCreateSettings(manager, ctx.userId);

        return repo.save(repo.merge(settings, data));
      });
    },
  },
  Query: {
    userSettings: async (_, __, ctx): Promise<GQLSettings> => {
      return ctx.con.transaction(
        async (manager): Promise<Settings> =>
          getOrCreateSettings(manager, ctx.userId),
      );
    },
  },
  Settings: {
    appInsaneMode: () => true,
    enableCardAnimations: () => true,
  },
});
