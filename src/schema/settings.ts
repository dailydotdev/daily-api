import {
  Keyword,
  KeywordCategory,
  KEYWORD_CATEGORY,
} from './../entity/Keyword';
import { gql, IResolvers } from 'apollo-server-fastify';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import { FeedTag, Settings } from '../entity';

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
}

interface GQLTagCategory {
  key: KeywordCategory;
  title: string;
}

interface GQLTagCategories {
  categories: GQLTagCategory[];
}

interface Tag {
  name: string;
  blocked: boolean;
}

interface CategoryTags {
  keywords: Tag[];
}

type CategoryFeedTag = Pick<Keyword, 'value'> & Pick<FeedTag, 'blocked'>;

export const typeDefs = gql`
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
  }

  type TagCategory {
    key: String!
    title: String!
  }

  type TagCategories {
    categories: [TagCategory]!
  }

  type CategoryTag {
    name: String!
    blocked: Boolean
  }

  type CategoryTags {
    keywords: [CategoryTag]!
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

    """
    Get the keywords of a category
    """
    categoryTags(
      """
      category of keywords to look for
      """
      category: String!
    ): CategoryTags! @auth

    """
    Get the list of available categories for tags
    """
    tagCategories: TagCategories!
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
    tagCategories: (): GQLTagCategories => ({
      categories: Object.keys(KEYWORD_CATEGORY).map((key: KeywordCategory) => ({
        key,
        title: KEYWORD_CATEGORY[key],
      })),
    }),
    categoryTags: async (
      _,
      { category }: { category: string },
      ctx,
    ): Promise<CategoryTags> => {
      const repo = ctx.getRepository(Keyword);
      const keywords = await repo
        .createQueryBuilder('keyword')
        .select('keyword.value, feed_tag.blocked')
        .leftJoin('feed_tag', 'feed_tag', 'keyword.value = feed_tag.tag')
        .leftJoin(
          'feed',
          'feed',
          'feed.id = feed_tag.feedId AND feed.userId = :userId',
          { userId: ctx.userId },
        )
        .where('keyword.categories @> ARRAY[:category]', { category })
        .execute();

      return {
        keywords: keywords.map(({ value, blocked }: CategoryFeedTag) => ({
          name: value,
          blocked,
        })),
      };
    },
  },
});
