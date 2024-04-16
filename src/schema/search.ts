import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import {
  getSessions,
  postFeedback,
  SearchResultFeedback,
  Search,
  getSession,
  SearchSession,
} from '../integrations';
import { ValidationError } from 'apollo-server-errors';
import {
  GQLEmptyResponse,
  getSearchQuery,
  offsetPageGenerator,
  processSearchQuery,
} from './common';
import { Connection as ConnectionRelay } from 'graphql-relay/connection/connection';
import graphorm from '../graphorm';
import { ConnectionArguments } from 'graphql-relay/index';
import { FeedArgs, feedResolver, fixedIdsFeedBuilder } from '../common';
import { GQLPost } from './posts';
import { searchMeili } from '../integrations/meilisearch';
import { Post, Source, UserPost } from '../entity';

type GQLSearchSession = Pick<SearchSession, 'id' | 'prompt' | 'createdAt'>;

interface GQLSearchPostSuggestion {
  id: string;
  title: string;
}

export interface GQLSearchPostSuggestionsResults {
  query: string;
  hits: GQLSearchPostSuggestion[];
}

export const typeDefs = /* GraphQL */ `
  type SearchSession {
    id: String!
    prompt: String!
    createdAt: DateTime!
  }

  type SearchSessionEdge {
    node: SearchSession!

    """
    Used in \`before\` and \`after\` args
    """
    cursor: String!
  }

  type SearchSessionConnection {
    pageInfo: PageInfo!
    edges: [SearchSessionEdge!]!
  }

  type SearchChunkError {
    message: String
    code: String
  }

  type SearchChunkSource {
    id: String!
    name: String!
    snippet: String!
    url: String!
  }

  type SearchChunk {
    id: String!
    prompt: String!
    response: String!
    error: SearchChunkError
    createdAt: DateTime!
    completedAt: DateTime!
    feedback: Int
    sources: [SearchChunkSource]
  }

  type Search {
    id: String!
    createdAt: DateTime!
    chunks: [SearchChunk]
  }

  type SearchPostSuggestion {
    id: String!
    title: String!
  }

  type SearchPostSuggestionsResults {
    query: String!
    hits: [SearchPostSuggestion!]!
  }

  extend type Query {
    """
    Get user's search history
    """
    searchSessionHistory(
      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int
    ): SearchSessionConnection! @auth

    """
    Get a search session by id
    """
    searchSession(id: String!): Search! @auth

    """
    Get suggestions for search post query
    """
    searchPostSuggestions(
      """
      The query to search for
      """
      query: String!

      """
      Version of the search algorithm
      """
      version: Int = 1
    ): SearchPostSuggestionsResults!

    """
    Get a posts feed of a search query
    """
    searchPosts(
      """
      The query to search for
      """
      query: String!

      """
      Time the pagination started to ignore new items
      """
      now: DateTime

      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int

      """
      Array of supported post types
      """
      supportedTypes: [String!]

      """
      Version of the search algorithm
      """
      version: Int = 1
    ): PostConnection!
  }

  extend type Mutation {
    """
    Send a feedback regarding the search result
    """
    searchResultFeedback(chunkId: String!, value: Int!): EmptyResponse! @auth
  }
`;

const searchResolver = feedResolver(
  (ctx, { query }: FeedArgs & { query: string }, builder, alias) =>
    builder
      .andWhere(`${alias}.tsv @@ (${getSearchQuery(':query')})`, {
        query: processSearchQuery(query),
      })
      .orderBy('ts_rank(tsv, search.query)', 'DESC')
      .orderBy('"createdAt"', 'DESC'),
  offsetPageGenerator(30, 50),
  (ctx, args, page, builder) => builder.limit(page.limit).offset(page.offset),
  {
    removeHiddenPosts: true,
    removeBannedPosts: false,
    allowPrivateSources: false,
  },
);

const meiliSearchResolver = feedResolver(
  (ctx, { ids }: FeedArgs & { ids: string[] }, builder, alias) =>
    fixedIdsFeedBuilder(ctx, ids, builder, alias),
  offsetPageGenerator(30, 50),
  (ctx, args, page, builder) => builder.limit(page.limit).offset(page.offset),
  {
    removeHiddenPosts: true,
    removeBannedPosts: false,
    allowPrivateSources: false,
  },
);

export const resolvers: IResolvers<unknown, Context> = traceResolvers({
  Query: {
    searchSessionHistory: async (
      _,
      args: ConnectionArguments,
      ctx,
    ): Promise<ConnectionRelay<GQLSearchSession>> => {
      const { first, after } = args;

      return graphorm.queryPaginatedIntegration(
        () => !!after,
        (nodeSize) => nodeSize === first,
        (node) => node.id,
        () => getSessions(ctx.userId, { limit: first, lastId: after }),
      );
    },
    searchSession: async (_, { id }: { id: string }, ctx): Promise<Search> =>
      getSession(ctx.userId, id),
    searchPostSuggestions: async (
      source,
      { query, version }: { query: string; version: number },
      ctx,
    ): Promise<GQLSearchPostSuggestionsResults> => {
      if (version === 2) {
        const hits = await searchMeili(
          `q=${query}&attributesToRetrieve=post_id,title`,
        );

        let newBuilder = ctx.con
          .createQueryBuilder()
          .select('post.id, post.title')
          .from(Post, 'post')
          .innerJoin(
            Source,
            'source',
            'source.id = post.sourceId AND source.private = false',
          )
          .where('post.id IN (:...ids)', { ids: hits.map((x) => x.post_id) });
        if (ctx.userId) {
          newBuilder = newBuilder
            .leftJoin(
              UserPost,
              'userpost',
              `userpost."postId" = "post".id AND userpost."userId" = :userId AND userpost.hidden = TRUE`,
              { userId: ctx.userId },
            )
            .andWhere('userpost."postId" IS NULL');
        }
        const cleanHits = await newBuilder.getRawMany();

        return {
          query,
          hits: cleanHits,
        };
      }
      const hits: GQLSearchPostSuggestion[] = await ctx.con.query(
        `
            WITH search AS (${getSearchQuery('$1')})
            select post.id, ts_headline(title, search.query,
                               'StartSel = <strong>, StopSel = </strong>') as title
            from post
            inner join search on true
            where tsv @@ search.query and not private
            order by ts_rank(tsv, search.query) desc, "createdAt" desc
              limit 5;
          `,
        [processSearchQuery(query)],
      );
      return {
        query,
        hits,
      };
    },
    searchPosts: async (
      source,
      args: FeedArgs & { query: string; version: number },
      ctx,
      info,
    ): Promise<ConnectionRelay<GQLPost> & { query: string }> => {
      if (args.version === 2) {
        const meilieSearchRes = await searchMeili(
          `q=${args.query}&attributesToRetrieve=post_id`,
        );

        const meilieArgs: FeedArgs & { ids: string[] } = {
          ...args,
          ids: meilieSearchRes.map((x) => x.post_id),
        };

        const res = await meiliSearchResolver(source, meilieArgs, ctx, info);
        return {
          ...res,
          query: args.query,
        };
      }

      const res = await searchResolver(source, args, ctx, info);
      return {
        ...res,
        query: args.query,
      };
    },
  },
  Mutation: {
    searchResultFeedback: async (
      _,
      { chunkId, value }: SearchResultFeedback,
      ctx,
    ): Promise<GQLEmptyResponse> => {
      if (value > 1 || value < -1) {
        throw new ValidationError('Invalid value');
      }

      await postFeedback(ctx.userId, { chunkId, value });

      return { _: true };
    },
  },
});
