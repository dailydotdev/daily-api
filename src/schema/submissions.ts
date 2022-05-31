import { Submission, User } from './../entity';
import { IResolvers } from 'graphql-tools';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import { isValidHttpUrl } from '../common';
import { getPostByUrl, GQLPost } from './posts';

interface GQLArticleSubmission {
  url: string;
}

type GQLSubmitArticleResponse = {
  result: 'succeed' | 'exists' | 'reject';
  reason?: string;
  post?: GQLPost;
  submission?: GQLSubmission;
};

interface GQLSubmission {
  id: string;
  url: string;
  userId: string;
  createdAt: Date;
  status: string;
  reason: string;
}

interface GQLSubmissionAvailability {
  hasAccess: boolean;
  limit: number;
  todaySubmissionsCount: number;
}

export const DEFAULT_SUBMISSION_LIMIT = '3';

export const typeDefs = /* GraphQL */ `
  type SubmissionAvailability {
    hasAccess: Boolean!
    limit: Int!
    todaySubmissionsCount: Int!
  }

  type Submission {
    id: String!
    url: String!
    userId: String!
    createdAt: DateTime!
    status: String!
    reason: String
  }

  type SubmitArticle {
    result: String!
    reason: String
    post: Post
    submission: Submission
  }

  extend type Query {
    """
    Information regarding the access of submitting community links
    """
    submissionAvailability: SubmissionAvailability!
  }
  extend type Mutation {
    """
    Submit an article to surface on users feed
    """
    submitArticle(url: String!): SubmitArticle @auth
  }
`;

export const resolvers: IResolvers<unknown, Context> = traceResolvers({
  Query: {
    submissionAvailability: async (
      _,
      __,
      ctx,
    ): Promise<GQLSubmissionAvailability> => {
      const limit = parseInt(
        process.env.SCOUT_SUBMISSION_LIMIT || DEFAULT_SUBMISSION_LIMIT,
      );

      const repo = ctx.getRepository(Submission);
      const user = await ctx.getRepository(User).findOne({ id: ctx.userId });
      if (!user) {
        return { limit, hasAccess: false, todaySubmissionsCount: 0 };
      }

      const timezone = user.timezone ?? 'utc';
      const nowTimezone = `timezone('${timezone}', now())`;
      const atTimezone = `at time zone '${timezone}'`;
      const submissions = await repo.find({
        where: `date_trunc('day', "createdAt")::timestamptz ${atTimezone} = date_trunc('day', ${nowTimezone})::timestamptz`,
      });
      const hasAccess = true; // subject for change on how we define the access

      return { limit, todaySubmissionsCount: submissions.length, hasAccess };
    },
  },
  Mutation: {
    submitArticle: async (
      _,
      { url }: GQLArticleSubmission,
      ctx,
      info,
    ): Promise<GQLSubmitArticleResponse> => {
      if (!isValidHttpUrl(url)) {
        return { result: 'reject', reason: 'invalid URL' };
      }

      const existingPost = await getPostByUrl(url, ctx, info);
      if (existingPost) {
        if (existingPost.deleted) {
          return { result: 'reject', reason: 'post is deleted' };
        }
        return { result: 'exists', post: existingPost };
      }

      const submissionRepo = ctx.con.getRepository(Submission);
      const existingSubmission = await submissionRepo.findOne({ url });

      if (existingSubmission) {
        return {
          result: 'reject',
          reason: `Article has been submitted already! Current status: ${existingSubmission.status}`,
        };
      }

      const submission = await submissionRepo.save(
        submissionRepo.create({ url, userId: ctx.userId }),
      );

      return { result: 'succeed', submission };
    },
  },
});
