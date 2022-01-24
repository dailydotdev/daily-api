import { IResolvers } from 'graphql-tools';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import { Settings } from '../entity';
import { isValidHttpUrl } from '../common';
import { ValidationError } from 'apollo-server-errors';

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

const getOrCreateSettings = async (ctx: Context): Promise<Settings> => {
  const repo = ctx.getRepository(Settings);
  const settings = await repo.findOne(ctx.userId);

  if (!settings) {
    return repo.save({ userId: ctx.userId });
  }

  return settings;
};

const updateUserSettings = async (
  data: GQLUpdateSettingsInput,
  ctx: Context,
) => {
  const repo = ctx.getRepository(Settings);
  const settings = await getOrCreateSettings(ctx);

  return repo.save(repo.merge(settings, data));
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = traceResolvers({
  Mutation: {
    updateUserSettings: async (
      _,
      { data }: { data: GQLUpdateSettingsInput },
      ctx,
    ): Promise<GQLSettings> => updateUserSettings(data, ctx),
    updateCustomLinks: async (
      _,
      { links }: { links: string[] },
      ctx,
    ): Promise<GQLSettings> => {
      if (!links?.length) {
        return updateUserSettings({ customLinks: null }, ctx);
      }

      const valid = links.every(isValidHttpUrl);

      if (!valid) {
        throw new ValidationError('One of the links is invalid');
      }

      return updateUserSettings({ customLinks: links }, ctx);
    },
  },
  Query: {
    userSettings: async (_, __, ctx): Promise<GQLSettings> =>
      getOrCreateSettings(ctx),
  },
  Settings: {
    appInsaneMode: () => true,
    enableCardAnimations: () => true,
  },
});
