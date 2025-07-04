import { DataSource } from 'typeorm';
import { Submission, User } from './../entity';
import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { AuthContext, BaseContext, Context } from '../Context';
import { getExistingPost, isValidHttpUrl, standardizeURL } from '../common';
import { getPostByUrl, GQLPost } from './posts';
import { SubmissionFailErrorMessage } from '../errors';
import { checkWithVordr, VordrFilterType } from '../common/vordr';
import { submissionAccessThreshold, submissionLimit } from '../config';

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

      const submissionRepo = ctx.con.getRepository(Submission);

      if (!hasSubmissionAccess(user)) {
        return {
          result: 'rejected',
          reason: SubmissionFailErrorMessage.ACCESS_DENIED,
        };
      }

      const limit = ctx.isTeamMember ? Infinity : submissionLimit;
      const submissionsToday = await getSubmissionsToday(ctx.con, user);

      if (submissionsToday.length >= limit) {
        return {
          result: 'rejected',
          reason: SubmissionFailErrorMessage.LIMIT_REACHED,
        };
      }

      if (!isValidHttpUrl(url)) {
        return {
          result: 'rejected',
          reason: SubmissionFailErrorMessage.INVALID_URL,
        };
      }

      const { url: cleanUrl, canonicalUrl } = standardizeURL(url);

      const existingPost = await getExistingPost(ctx.con, {
        url: cleanUrl,
        canonicalUrl,
      });

      if (existingPost) {
        if (existingPost.deleted || !existingPost.visible) {
          return {
            result: 'rejected',
            reason: SubmissionFailErrorMessage.POST_DELETED,
          };
        }

        return {
          result: 'exists',
          post: await getPostByUrl(ctx, info, {
            url: cleanUrl,
            canonicalUrl,
          }),
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
