import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { AuthContext, BaseContext } from '../Context';
import { FeedSentiment } from '../entity/FeedSentiment';
import { GQLEmptyResponse } from './common';

export const typeDefs = /* GraphQL */ `
  extend type Mutation {
    """
    Submit feed sentiment feedback (rate limited to 5 per hour)
    """
    submitFeedSentiment(sentiment: String!): EmptyResponse!
      @auth
      @rateLimit(limit: 5, duration: 3600)
  }
`;

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Mutation: {
    submitFeedSentiment: async (
      _,
      { sentiment }: { sentiment: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      // Validate sentiment value
      const validSentiments = ['good', 'neutral', 'bad'];
      if (!validSentiments.includes(sentiment)) {
        throw new Error('Invalid sentiment value');
      }

      // Create feed sentiment record
      const feedSentimentRepo = ctx.con.getRepository(FeedSentiment);
      await feedSentimentRepo.save({
        userId: ctx.userId,
        sentiment,
      });

      return {
        _: true,
      };
    },
  },
});
