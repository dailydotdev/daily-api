import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import {
  postFeedback,
  SearchResultFeedback,
  Search,
  getSession,
} from '../integrations';
import { ValidationError } from 'apollo-server-errors';
import { GQLEmptyResponse } from './common';

export const typeDefs = /* GraphQL */ `
  type SearchSession {
    id: String!
    prompt: String!
    createdAt: DateTime!
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
