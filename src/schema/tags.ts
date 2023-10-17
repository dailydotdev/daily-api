import { IResolvers } from '@graphql-tools/utils';
import { Context } from '../Context';
import { traceResolvers } from './trace';
import { Keyword } from '../entity';

interface GQLTag {
  name: string;
}

interface GQLTagSearchResults {
  query: string;
  hits: GQLTag[];
}

type GQLTagOnboardingResults = Pick<GQLTagSearchResults, 'hits'>;

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

  type TagOnboardingResults {
    """
    Query that was searched
    """
    query: String!
    """
    Search results
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
    onboardingTags: TagOnboardingResults!
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
      const hits = await ctx
        .getRepository(Keyword)
        .createQueryBuilder()
        .select('value')
        .where(`status = 'allow'`)
        .andWhere(`value ilike :query`, { query: `%${query}%` })
        .orderBy('value', 'ASC')
        .getRawMany();
      return {
        query,
        hits: hits.map((x) => ({ name: x.value })),
      };
    },
    onboardingTags: async (
      source,
      args,
      ctx,
    ): Promise<GQLTagOnboardingResults> => {
      const hits = await ctx.getRepository(Keyword).find({
        select: ['value'],
        where: {
          status: 'allow',
          flags: {
            onboarding: true,
          },
        },
        order: { value: 'ASC' },
      });

      return {
        hits: hits.map((x) => ({ name: x.value })),
      };
    },
  },
});
