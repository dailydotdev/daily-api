import { Post, Submission } from './../entity';
import { IResolvers } from 'graphql-tools';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import { getDiscussionLink, isValidHttpUrl } from '../common';
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

      const postRepo = ctx.con.getRepository(Post);
      const existingPost = await postRepo
        .createQueryBuilder('post')
        .where('url = :url or "canonicalUrl" = :url', { url })
        .andWhere('deleted = false')
        .leftJoinAndSelect('post.source', 'source')
        .getOne();
      if (existingPost) {
        const post = {
          ...existingPost,
          source: await existingPost.source,
          commentsPermalink: getDiscussionLink(existingPost.id),
        };
        throw new ValidationError(JSON.stringify({ post }));
      }

      const submissionRepo = ctx.con.getRepository(Submission);
      const existingSubmission = await submissionRepo.findOne(url);

      if (existingSubmission) {
        throw new ValidationError(
          'Article has been submitted already! Current status: ' +
            existingSubmission.status,
        );
      }

      await submissionRepo.save(
        submissionRepo.create({ url, userId: ctx.userId }),
      );

      return { _: true };
    },
  },
});
