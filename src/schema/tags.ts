import { IResolvers } from '@graphql-tools/utils';
import { AuthContext, BaseContext, Context } from '../Context';
import { Keyword } from '../entity';
import { TagRecommendation } from '../entity/TagRecommendation';
import { In, Not, ObjectType } from 'typeorm';
import { ValidationError } from 'apollo-server-errors';
import { SubmissionFailErrorMessage } from '../errors';
import graphorm from '../graphorm';
import { GQLKeyword } from './keywords';
import { TrendingTag } from '../entity/TrendingTag';
import { PopularTag } from '../entity/PopularTag';
import { getFeedTagsList } from '../common/feedTagsList';
import { feedTagsListInputSchema } from '../common/schema/feedTagsList';
import { z } from 'zod';
import {
  MIN_SEARCH_QUERY_LENGTH,
  RECOMMENDED_TAGS_LIMIT,
  SEARCH_TAGS_LIMIT,
} from '../types';

interface GQLTag {
  name: string;
}

interface GQLTagSearchResults {
  query: string;
  hits: GQLTag[];
}

export type GQLTagResults = Pick<GQLTagSearchResults, 'hits'>;

export const typeDefs = /* GraphQL */ `
  """
  Post tag
  """
  type Tag {
    """
    The actual text of the tag
    """
    name: String!
  }

  """
  Tag search results
  """
  type TagSearchResults {
    """
    Query that was searched
    """
    query: String!
    """
    Search results
    """
    hits: [Tag]!
  }

  type TagResults {
    """
    Results
    """
    hits: [Tag]!
  }

  """
  A single tag chip with the keyword slug and a human-friendly label.
  """
  type FeedTagsListItem {
    """
    Keyword value, used for URL slugs and feed filtering.
    """
    value: String!
    """
    Human-friendly display label.
    """
    label: String!
  }

  """
  Personalized feed tag list returned for the signed-in user.
  """
  type FeedTagsList {
    """
    Tags to render as chips
    """
    tags: [FeedTagsListItem!]!
  }

  extend type Query {
    """
    Get all tags
    """
    tags: [Keyword]

    """
    Get the most trending tags
    """
    trendingTags(
      """
      Limit the number of tags returned
      """
      limit: Int
    ): [Tag] @cacheControl(maxAge: 600)

    """
    Get the most popular tags
    """
    popularTags(
      """
      Limit the number of tags returned
      """
      limit: Int
    ): [Tag] @cacheControl(maxAge: 600)

    searchTags(query: String!): TagSearchResults @cacheControl(maxAge: 600)

    """
    Get initial list of tags recommended for onboarding
    """
    onboardingTags: TagResults!

    """
    Tag chips to render in the unified feed nav for the signed-in user.
    Cached in user.flags.feedTagsList for 24 hours; backfilled with
    onboardingRecommendTags when the feed service returns fewer than the requested limit.
    """
    feedTagsList(limit: Int = 10): FeedTagsList! @auth

    """
    Get recommended tags based on current selected and shown tags
    """
    recommendedTags(
      """
      Tags for which we need to find other recommended tags
      """
      tags: [String]!

      """
      Tags which should be excluded from recommendations
      """
      excludedTags: [String]!
    ): TagResults!
  }
`;

type TagQueryArgs = { limit?: number };

const getFormattedTags = async (
  entity: ObjectType<TrendingTag | PopularTag>,
  args: TagQueryArgs,
  ctx: Context,
): Promise<GQLTag[]> => {
  const { limit = 10 } = args;
  const tags = await ctx.getRepository(entity).find({
    select: ['tag'],
    order: { r: 'DESC' },
    take: limit,
  });
  return tags.map(({ tag }) => ({ name: tag }));
};

export const resolvers: IResolvers<unknown, BaseContext> = {
  Query: {
    tags: (_, __, ctx: Context, info): Promise<GQLKeyword[]> =>
      graphorm.query<GQLKeyword>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder = builder.queryBuilder
            .where({
              status: 'allow',
            })
            .orderBy('value', 'ASC')
            .limit(1000);

          return builder;
        },
        true,
      ),
    trendingTags: async (
      _,
      args: TagQueryArgs,
      ctx: Context,
    ): Promise<GQLTag[]> => await getFormattedTags(TrendingTag, args, ctx),
    popularTags: async (
      _,
      args: TagQueryArgs,
      ctx: Context,
    ): Promise<GQLTag[]> => await getFormattedTags(PopularTag, args, ctx),
    searchTags: async (
      source,
      { query }: { query: string },
      ctx,
    ): Promise<GQLTagSearchResults> => {
      if (query.length < MIN_SEARCH_QUERY_LENGTH) {
        return {
          query,
          hits: [],
        };
      }

      const hits = await ctx
        .getRepository(Keyword)
        .createQueryBuilder()
        .select('value')
        .where(`status = 'allow'`)
        .andWhere(`value ilike :query`, { query: `%${query}%` })
        .orderBy('value', 'ASC')
        .limit(SEARCH_TAGS_LIMIT)
        .getRawMany();
      return {
        query,
        hits: hits.map((x) => ({ name: x.value })),
      };
    },
    onboardingTags: async (source, args, ctx): Promise<GQLTagResults> => {
      const hits = await ctx
        .getRepository(Keyword)
        .createQueryBuilder()
        .select('value')
        .where(`(flags->'onboarding') = 'true'`)
        .orderBy('value', 'ASC')
        .execute();

      return {
        hits: hits.map((hit: Keyword) => ({ name: hit.value })),
      };
    },
    feedTagsList: (
      _,
      args: z.input<typeof feedTagsListInputSchema>,
      ctx: AuthContext,
    ) => {
      const { limit } = feedTagsListInputSchema.parse(args);
      return getFeedTagsList({ con: ctx.con, userId: ctx.userId, limit });
    },
    recommendedTags: async (
      source,
      { tags, excludedTags },
      ctx,
    ): Promise<GQLTagResults> => {
      const uniqueTagsToExclude = new Set([...tags, ...excludedTags]);

      if (uniqueTagsToExclude.size > 1000) {
        throw new ValidationError(
          SubmissionFailErrorMessage.ONBOARDING_TAG_LIMIT_REACHED,
        );
      }

      const hits = await ctx.getRepository(TagRecommendation).find({
        select: ['keywordY'],
        where: {
          keywordX: In(tags),
          keywordY: Not(In([...uniqueTagsToExclude])),
        },
        order: {
          probability: 'DESC',
          keywordY: 'ASC',
        },
        take: RECOMMENDED_TAGS_LIMIT,
      });

      return {
        hits: hits.map((hit) => ({ name: hit.keywordY })),
      };
    },
  },
};
