import { DataSource } from 'typeorm';
import { ArticlePost, Submission, User } from './../entity';
import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { AuthContext, BaseContext, Context } from '../Context';
import { isValidHttpUrl, standardizeURL } from '../common';
import { getPostByUrl, GQLPost } from './posts';
import { SubmissionFailErrorMessage } from '../errors';
import { checkWithVordr, VordrFilterType } from '../common/vordr';

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

export interface GQLSubmissionAvailability {
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

export const hasSubmissionAccess = (user: User) =>
  user.reputation >= submissionAccessThreshold;

const getSubmissionsToday = (con: DataSource, user: User) => {
  const timezone = user.timezone ?? 'utc';
  const atTimezone = `at time zone '${timezone}'`;

  return con
    .getRepository(Submission)
    .createQueryBuilder()
    .select('*')
    .where(
      `date_trunc('day', timezone('UTC', "createdAt") ${atTimezone})::timestamptz = date_trunc('day', now() ${atTimezone})::timestamptz`,
    )
    .andWhere('"userId" = :id', { id: user.id })
    .execute();
};

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    submissionAvailability: async (
      _,
      __,
      ctx: Context,
    ): Promise<GQLSubmissionAvailability> => {
      const user = ctx.userId
        ? await ctx.getRepository(User).findOneBy({ id: ctx.userId })
        : null;

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
      ctx: AuthContext,
      info,
    ): Promise<GQLSubmitArticleResponse> => {
      const user = await ctx
        .getRepository(User)
        .findOneByOrFail({ id: ctx.userId });

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

      const existingPost = await ctx
        .getRepository(ArticlePost)
        .findOneBy([{ url }, { canonicalUrl: url }]);
      if (existingPost) {
        if (existingPost.deleted || !existingPost.visible) {
          return {
            result: 'rejected',
            reason: SubmissionFailErrorMessage.POST_DELETED,
          };
        }

        return {
          result: 'exists',
          post: await getPostByUrl(cleanUrl, ctx, info),
        };
      }

      const existingSubmission = await submissionRepo.findOneBy({
        url: cleanUrl,
      });

      if (existingSubmission) {
        return {
          result: 'rejected',
          reason:
            SubmissionFailErrorMessage[
              `EXISTS_${existingSubmission.status}` as keyof typeof SubmissionFailErrorMessage
            ],
        };
      }

      const createdSubmission = submissionRepo.create({
        url: cleanUrl,
        userId: ctx.userId,
      });

      createdSubmission.flags = {
        ...createdSubmission.flags,
        vordr: await checkWithVordr(
          { id: createdSubmission.id, type: VordrFilterType.Submission },
          ctx,
        ),
      };

      const submission = await submissionRepo.save(createdSubmission);

      return { result: 'succeed', submission };
    },
  },
});
