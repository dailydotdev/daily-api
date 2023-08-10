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
    searchResultFeedback(chunkId: String!, feedback: Int!): EmptyResponse! @auth
  }
`;

export const resolvers: IResolvers<unknown, Context> = traceResolvers({
  Mutation: {
    searchResultFeedback: async (
      _,
      { chunkId, feedback }: SearchResultFeedback,
      ctx,
    ): Promise<GQLEmptyResponse> => {
      if (feedback > 1 || feedback < -1) {
        throw new ValidationError('Invalid value');
      }

      await postFeedback(ctx.userId, { chunkId, feedback });

      return { _: true };
    },
  },
});
