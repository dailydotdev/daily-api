import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import {
  getSessions,
  postFeedback,
  SearchResultFeedback,
  SearchSessionHistory,
} from '../integrations';
import { ValidationError } from 'apollo-server-errors';
import { GQLEmptyResponse } from './common';

type GQLSearchSessionHistory = Pick<
  SearchSessionHistory,
  'id' | 'prompt' | 'createdAt'
>;

export const typeDefs = /* GraphQL */ `
  extend type Query {
    """
    Send a feedback regarding the search result
    """
    searchSessionHistory: EmptyResponse! @auth
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
      __,
      ctx,
    ): Promise<GQLSearchSessionHistory[]> => getSessions(ctx.userId),
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
