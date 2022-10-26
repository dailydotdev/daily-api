import { Connection } from 'typeorm';
import { Submission, User } from './../entity';
import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import { isValidHttpUrl, standardizeURL } from '../common';
import { getPostByUrl, GQLPost } from './posts';
import { SubmissionFailErrorMessage } from '../errors';

interface GQLArticleSubmission {
  url: string;
}

type GQLSubmitArticleResponse = {
  result: 'succeed' | 'exists' | 'rejected';
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

const getSubmissionsToday = (con: Connection, user: User) => {
  const timezone = user.timezone ?? 'utc';
  const atTimezone = `at time zone '${timezone}'`;

  return con
    .getRepository(Submission)
    .createQueryBuilder()
    .select('*')
    .where(
      `date_trunc('day', "createdAt")::timestamptz ${atTimezone} = date_trunc('day', now())::timestamptz ${atTimezone}`,
    )
    .andWhere('"userId" = :id', { id: user.id })
    .execute();
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

      const submissionsToday = await getSubmissionsToday(ctx.con, user);

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

      if (!hasSubmissionAccess(user)) {
        return {
          result: 'rejected',
          reason: SubmissionFailErrorMessage.ACCESS_DENIED,
        };
      }

      const submissionRepo = ctx.con.getRepository(Submission);
      const submissionsToday = await getSubmissionsToday(ctx.con, user);

      if (submissionsToday.length >= submissionLimit) {
        return {
          result: 'rejected',
          reason: SubmissionFailErrorMessage.LIMIT_REACHED,
        };
      }

      const cleanUrl = standardizeURL(url);

      if (!isValidHttpUrl(cleanUrl)) {
        return {
          result: 'rejected',
          reason: SubmissionFailErrorMessage.INVALID_URL,
        };
      }

      const existingPost = await getPostByUrl(cleanUrl, ctx, info);
      if (existingPost) {
        if (existingPost.deleted) {
          return {
            result: 'rejected',
            reason: SubmissionFailErrorMessage.POST_DELETED,
          };
        }
        return { result: 'exists', post: existingPost };
      }

      const existingSubmission = await submissionRepo.findOne({
        url: cleanUrl,
      });

      if (existingSubmission) {
        return {
          result: 'rejected',
          reason:
            SubmissionFailErrorMessage[`EXISTS_${existingSubmission.status}`],
        };
      }

      const submission = await submissionRepo.save({
        url: cleanUrl,
        userId: ctx.userId,
      });

      return { result: 'succeed', submission };
    },
  },
});
