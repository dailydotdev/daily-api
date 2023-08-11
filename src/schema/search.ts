import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import {
  getSessions,
  postFeedback,
  SearchResultFeedback,
  SearchSession,
  SearchSessionParams,
} from '../integrations';
import { ValidationError } from 'apollo-server-errors';
import { GQLEmptyResponse } from './common';

type GQLSearchSession = Pick<SearchSession, 'id' | 'prompt' | 'createdAt'>;
type GQLSearchSessionParams = Pick<SearchSessionParams, 'limit' | 'lastId'>;

export const typeDefs = /* GraphQL */ `
  type SearchSession {
    id: String!
    prompt: String!
    createdAt: String!
  }

  extend type Query {
    """
    Get user's search history
    """
    searchSessionHistory(limit: Int, lastId: String): [SearchSession]! @auth
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
    ): Promise<GQLSearchSession[]> =>
      getSessions(ctx.userId, { limit, lastId }),
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
