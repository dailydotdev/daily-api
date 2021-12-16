import { IResolvers } from 'graphql-tools';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import { Settings } from '../entity';

interface GQLSettings {
  userId: string;
  theme: string;
  enableCardAnimations: boolean;
  showTopSites: boolean;
  insaneMode: boolean;
  appInsaneMode: boolean;
  spaciness: string;
  showOnlyUnreadPosts: boolean;
  openNewTab: boolean;
  sidebarExpanded: boolean;
  updatedAt: Date;
}

interface GQLUpdateSettingsInput extends Partial<GQLSettings> {
  theme?: string;
  enableCardAnimations?: boolean;
  showTopSites?: boolean;
  insaneMode?: boolean;
  appInsaneMode?: boolean;
  spaciness?: string;
  showOnlyUnreadPosts?: boolean;
  openNewTab?: boolean;
  sidebarExpanded?: boolean;
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
  }

  extend type Mutation {
    """
    Update the user settings
    """
    updateUserSettings(data: UpdateSettingsInput!): Settings! @auth
  }

  extend type Query {
    """
    Get the user settings
    """
    userSettings: Settings! @auth
  }
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = traceResolvers({
  Mutation: {
    updateUserSettings: async (
      source,
      { data }: { data: GQLUpdateSettingsInput },
      ctx,
    ): Promise<GQLSettings> => {
      const repo = ctx.getRepository(Settings);
      const settings = await repo.findOne(ctx.userId);
      if (!settings) {
        return repo.save(repo.merge(repo.create(data), { userId: ctx.userId }));
      }
      return repo.save(repo.merge(settings, data));
    },
  },
  Query: {
    userSettings: async (source, args, ctx): Promise<GQLSettings> => {
      const repo = ctx.getRepository(Settings);
      const settings = await repo.findOne(ctx.userId);
      // TODO: need to come up with a better solution for non existing settings
      if (!settings) {
        await repo.insert({ userId: ctx.userId });
        return repo.findOne(ctx.userId);
      }
      return settings;
    },
  },
});
