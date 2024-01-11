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
} from './common';
import { Connection as ConnectionRelay } from 'graphql-relay/connection/connection';
import graphorm from '../graphorm';
import { ConnectionArguments } from 'graphql-relay/index';
import { FeedArgs, feedResolver } from '../common';
import { GQLPost } from './posts';

type GQLSearchSession = Pick<SearchSession, 'id' | 'prompt' | 'createdAt'>;

interface GQLSearchPostSuggestion {
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
        query,
      })
      .orderBy('views', 'DESC'),
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
      { query }: { query: string },
      ctx,
    ): Promise<GQLSearchPostSuggestionsResults> => {
      const hits: { title: string }[] = await ctx.con.query(
        `
            WITH search AS (${getSearchQuery('$1')})
            select ts_headline(process_text(title), search.query,
                               'StartSel = <strong>, StopSel = </strong>') as title
            from post
                   inner join search on true
                   inner join source on source.id = post."sourceId"
            where tsv @@ search.query and source.private = false
            order by views desc
              limit 5;
          `,
        [query],
      );
      return {
        query,
        hits,
      };
    },
    searchPosts: async (
      source,
      args: FeedArgs & { query: string },
      ctx,
      info,
    ): Promise<ConnectionRelay<GQLPost> & { query: string }> => {
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
