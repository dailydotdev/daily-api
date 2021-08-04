import { gql, IResolvers } from 'apollo-server-fastify';
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

export const typeDefs = gql`
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

  extend type Query {
    """
    Get the most popular tags
    """
    popularTags: [Tag] @cacheControl(maxAge: 600)

    searchTags(query: String!): TagSearchResults @cacheControl(maxAge: 600)
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
  },
});
