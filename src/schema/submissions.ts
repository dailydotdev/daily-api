import { User } from './../entity';
import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { BaseContext } from '../Context';
import { GQLPost } from './posts';
import { SubmissionFailErrorMessage } from '../errors';
import { submissionAccessThreshold } from '../config';

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
      @deprecated(
        reason: "This feature is deprecated, please use the new submission process"
      )
  }
  extend type Mutation {
    """
    Submit an article to surface on users feed
    """
    submitArticle(url: String!): SubmitArticle
      @auth
      @deprecated(
        reason: "This feature is deprecated, please use the new submission process"
      )
  }
`;

export const hasSubmissionAccess = (user: User) =>
  user.reputation >= submissionAccessThreshold;

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    // Feature deprecated, will be removed in the future
    submissionAvailability: async (): Promise<GQLSubmissionAvailability> => {
      return {
        limit: 0,
        hasAccess: false,
        todaySubmissionsCount: 0,
      };
    },
  },
  Mutation: {
    // Feature deprecated, will be removed in the future
    submitArticle: async (): Promise<GQLSubmitArticleResponse> => {
      return {
        result: 'rejected',
        reason: SubmissionFailErrorMessage.COMMUNITY_PICKS_DEPRECATED,
      };
    },
  },
});
