import { IResolvers } from '@graphql-tools/utils';
import { UserFeedbackCategory } from '@dailydotdev/schema';
import { traceResolvers } from './trace';
import { AuthContext, BaseContext } from '../Context';
import { Feedback, FeedbackStatus } from '../entity/Feedback';
import { ValidationError } from 'apollo-server-errors';
import { feedbackInputSchema } from '../common/schema/feedback';
import { ZodError } from 'zod/v4';
import { toGQLEnum } from '../common/utils';

interface GQLFeedbackInput {
  category: string;
  description: string;
  pageUrl?: string;
  userAgent?: string;
}

interface GQLFeedbackResult {
  success: boolean;
  feedbackId?: string;
}

export const typeDefs = /* GraphQL */ `
  ${toGQLEnum(UserFeedbackCategory, 'FeedbackCategory')}

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
    Submit user feedback (rate limited to 10 per day)
    """
    submitFeedback(input: FeedbackInput!): FeedbackResult!
      @auth
      @rateLimit(limit: 10, duration: 86400)
  }
`;

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
      // Validate input with Zod
      try {
        feedbackInputSchema.parse(input);
      } catch (err) {
        if (err instanceof ZodError) {
          throw new ValidationError(
            err.issues.map((e) => e.message).join(', '),
          );
        }
        throw err;
      }

      // Create feedback record
      // CDC will pick this up and handle classification via PubSub
      const feedback = await ctx.con.getRepository(Feedback).save({
        userId: ctx.userId,
        category: input.category as UserFeedbackCategory,
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
