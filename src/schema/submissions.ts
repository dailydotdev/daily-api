import { Submission } from './../entity';
import { IResolvers } from 'graphql-tools';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import { isValidHttpUrl } from '../common';
import { ValidationError } from 'apollo-server-errors';
import { GQLEmptyResponse } from './common';

interface GQLArticleSubmission {
  url: string;
}

export const typeDefs = /* GraphQL */ `
  extend type Mutation {
    """
    Submit an article to surface on users feed
    """
    submitArticle(url: String!): EmptyResponse @auth
  }
`;

export const resolvers: IResolvers<unknown, Context> = traceResolvers({
  Mutation: {
    submitArticle: async (
      _,
      { url }: GQLArticleSubmission,
      ctx,
    ): Promise<GQLEmptyResponse> => {
      if (!isValidHttpUrl(url)) {
        throw new ValidationError('Invalid URL!');
      }

      const repo = ctx.con.getRepository(Submission);
      const existing = await repo.findOne(url);

      if (existing) {
        throw new ValidationError(
          'Article has been submitted already! Current status: ' +
            existing.status,
        );
      }

      await repo.save(repo.create({ url, userId: ctx.userId }));

      return { _: true };
    },
  },
});
