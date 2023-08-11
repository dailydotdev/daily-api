import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import { postFeedback, SearchResultFeedback } from '../integrations';
import { ValidationError } from 'apollo-server-errors';
import { GQLEmptyResponse } from './common';

export const typeDefs = /* GraphQL */ `
  extend type Mutation {
    """
    Send a feedback regarding the search result
    """
    searchResultFeedback(chunkId: String!, value: Int!): EmptyResponse! @auth
  }
`;

export const resolvers: IResolvers<unknown, Context> = traceResolvers({
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
