import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { AuthContext, BaseContext } from '../Context';
import { Feedback, FeedbackCategory, FeedbackStatus } from '../entity';
import { ForbiddenError, ValidationError } from 'apollo-server-errors';
import { toGQLEnum } from '../common';
import { MoreThan } from 'typeorm';

const FEEDBACK_MAX_DESCRIPTION_LENGTH = 2000;
const FEEDBACK_RATE_LIMIT_PER_HOUR = 5;

interface GQLFeedbackInput {
  category: FeedbackCategory;
  description: string;
  pageUrl?: string;
  userAgent?: string;
}

interface GQLFeedbackResult {
  success: boolean;
  feedbackId?: string;
}

export const typeDefs = /* GraphQL */ `
  ${toGQLEnum(FeedbackCategory, 'FeedbackCategory')}

  """
  Input for submitting user feedback
  """
  input FeedbackInput {
    """
    Category of feedback (BUG, FEATURE_REQUEST, GENERAL, OTHER)
    """
    category: FeedbackCategory!

    """
    User's feedback description (max 2000 characters)
    """
    description: String!

    """
    Current page URL where feedback was submitted
    """
    pageUrl: String

    """
    Browser user agent for debugging context
    """
    userAgent: String
  }

  """
  Result of feedback submission
  """
  type FeedbackResult {
    """
    Whether the submission was successful
    """
    success: Boolean!

    """
    ID of the created feedback record
    """
    feedbackId: ID
  }

  extend type Mutation {
    """
    Submit user feedback
    """
    submitFeedback(input: FeedbackInput!): FeedbackResult! @auth
  }
`;

async function countRecentFeedback(
  ctx: AuthContext,
  intervalHours: number,
): Promise<number> {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - intervalHours);

  return ctx.con.getRepository(Feedback).countBy({
    userId: ctx.userId,
    createdAt: MoreThan(cutoffTime),
  });
}

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Mutation: {
    submitFeedback: async (
      _,
      { input }: { input: GQLFeedbackInput },
      ctx: AuthContext,
    ): Promise<GQLFeedbackResult> => {
      // Validate description length
      if (input.description.length > FEEDBACK_MAX_DESCRIPTION_LENGTH) {
        throw new ValidationError(
          `Description must be ${FEEDBACK_MAX_DESCRIPTION_LENGTH} characters or less`,
        );
      }

      if (input.description.trim().length === 0) {
        throw new ValidationError('Description cannot be empty');
      }

      // Validate category
      if (!Object.values(FeedbackCategory).includes(input.category)) {
        throw new ValidationError('Invalid feedback category');
      }

      // Rate limit check
      const recentCount = await countRecentFeedback(ctx, 1);
      if (recentCount >= FEEDBACK_RATE_LIMIT_PER_HOUR) {
        throw new ForbiddenError(
          'Too many feedback submissions. Please try again later.',
        );
      }

      // Create feedback record
      // CDC will pick this up and handle classification via PubSub
      const feedback = await ctx.con.getRepository(Feedback).save({
        userId: ctx.userId,
        category: input.category,
        description: input.description.trim(),
        pageUrl: input.pageUrl || null,
        userAgent: input.userAgent || null,
        status: FeedbackStatus.Pending,
        flags: {},
      });

      return {
        success: true,
        feedbackId: feedback.id,
      };
    },
  },
});
