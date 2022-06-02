import { Connection } from 'typeorm';
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
export const DEFAULT_SUBMISSION_ACCESS_THRESHOLD = '250';

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

const submissionLimit = parseInt(
  process.env.SCOUT_SUBMISSION_LIMIT || DEFAULT_SUBMISSION_LIMIT,
);

export const submissionAccessThreshold = parseInt(
  process.env.SCOUT_SUBMISSION_ACCESS_THRESHOLD ||
    DEFAULT_SUBMISSION_ACCESS_THRESHOLD,
);

const hasSubmissionAccess = (user: User) =>
  user.reputation >= submissionAccessThreshold;

const getSubmissionsToday = (con: Connection, userTimezone?: string) => {
  const timezone = userTimezone ?? 'utc';
  const nowTimezone = `timezone('${timezone}', now())`;
  const atTimezone = `at time zone '${timezone}'`;

  return con.getRepository(Submission).find({
    where: `date_trunc('day', "createdAt")::timestamptz ${atTimezone} = date_trunc('day', ${nowTimezone})::timestamptz`,
  });
};

export const resolvers: IResolvers<unknown, Context> = traceResolvers({
  Query: {
    submissionAvailability: async (
      _,
      __,
      ctx,
    ): Promise<GQLSubmissionAvailability> => {
      const user = await ctx.getRepository(User).findOne({ id: ctx.userId });
      if (!user) {
        return {
          limit: submissionLimit,
          hasAccess: false,
          todaySubmissionsCount: 0,
        };
      }

      const submissionsToday = await getSubmissionsToday(
        ctx.con,
        user.timezone,
      );

      return {
        limit: submissionLimit,
        todaySubmissionsCount: submissionsToday.length,
        hasAccess: hasSubmissionAccess(user),
      };
    },
  },
  Mutation: {
    submitArticle: async (
      _,
      { url }: GQLArticleSubmission,
      ctx,
      info,
    ): Promise<GQLSubmitArticleResponse> => {
      const user = await ctx.getRepository(User).findOne({ id: ctx.userId });

      if (!user || !hasSubmissionAccess(user)) {
        return { result: 'reject', reason: 'Access denied' };
      }

      const submissionRepo = ctx.con.getRepository(Submission);
      const submissionsToday = await getSubmissionsToday(
        ctx.con,
        user.timezone,
      );

      if (submissionsToday.length >= submissionLimit) {
        return { result: 'reject', reason: 'Submission limit reached' };
      }

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
