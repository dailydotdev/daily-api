import { IResolvers } from '@graphql-tools/utils';
import { Context } from '../Context';
import { traceResolvers } from './trace';
import { Keyword } from '../entity';
import { TagRecommendation } from '../entity/TagRecommendation';
import { In, Not } from 'typeorm';
import { ValidationError } from 'apollo-server-errors';
import { SubmissionFailErrorMessage } from '../errors';

interface GQLTag {
  name: string;
}

interface GQLTagSearchResults {
  query: string;
  hits: GQLTag[];
}

export type GQLTagResults = Pick<GQLTagSearchResults, 'hits'>;

export const RECOMMENDED_TAGS_LIMIT = 5;

export const MIN_SEARCH_QUERY_LENGTH = 2;

export const SEARCH_TAGS_LIMIT = 100;

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

  extend type Query {
    """
    Get the most popular tags
    """
    popularTags: [Tag] @cacheControl(maxAge: 600)

    searchTags(query: String!): TagSearchResults @cacheControl(maxAge: 600)

    """
    Get initial list of tags recommended for onboarding
    """
    onboardingTags: TagResults!

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = traceResolvers({
  Query: {
    popularTags: async (source, args, ctx): Promise<GQLTag[]> => {
      const hits = await ctx.getRepository(Keyword).find({
        select: ['value'],
        order: { value: 'ASC' },
        where: { status: 'allow' },
      });
      return hits.map((x) => ({ name: x.value }));
    },
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
        hits: hits.map((hit) => ({ name: hit.value })),
      };
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
});
