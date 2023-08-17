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
  SearchSessionParams,
} from '../integrations';
import { ValidationError } from 'apollo-server-errors';
import { GQLEmptyResponse } from './common';
import { Connection as ConnectionRelay } from 'graphql-relay/connection/connection';
import { base64 } from '../common';
import graphorm from '../graphorm';

type GQLSearchSession = Pick<SearchSession, 'id' | 'prompt' | 'createdAt'>;
type GQLSearchSessionParams = Pick<SearchSessionParams, 'limit' | 'lastId'>;

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
    message: String!
    code: String!
  }

  type SearchChunkSource {
    id: String!
    title: String!
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

  extend type Query {
    """
    Get user's search history
    """
    searchSessionHistory(limit: Int, lastId: String): [SearchSession]! @auth

    """
    Get a search session by id
    """
    searchSession(id: String!): Search! @auth
  }

  extend type Mutation {
    """
    Send a feedback regarding the search result
    """
    searchResultFeedback(chunkId: String!, value: Int!): EmptyResponse! @auth
  }
`;

export const resolvers: IResolvers<unknown, Context> = traceResolvers({
  Query: {
    searchSessionHistory: async (
      _,
      { limit, lastId }: GQLSearchSessionParams,
      ctx,
    ): Promise<ConnectionRelay<GQLSearchSession>> => {
      return graphorm.queryPaginatedIntegration(
        () => !!lastId,
        (nodeSize) => nodeSize === limit,
        (node) => base64(`timestamp:${node.createdAt}`),
        () => getSessions(ctx.userId, { limit, lastId }),
      );
    },
    searchSession: async (_, { id }: { id: string }, ctx): Promise<Search> =>
      getSession(ctx.userId, id),
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
