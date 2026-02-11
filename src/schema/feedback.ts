import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { AuthContext, BaseContext } from '../Context';
import { Feedback, FeedbackStatus } from '../entity/Feedback';
import { ContentImage, ContentImageUsedByType } from '../entity/ContentImage';
import { ValidationError } from 'apollo-server-errors';
import { feedbackInputSchema } from '../common/schema/feedback';
import { ZodError } from 'zod/v4';
import { GQLEmptyResponse } from './common';

interface GQLFeedbackInput {
  category: number;
  description: string;
  pageUrl?: string;
  userAgent?: string;
  screenshotUrl?: string;
}

export const typeDefs = /* GraphQL */ `
  """
  Input for submitting user feedback
  """
  input FeedbackInput {
    """
    Category of feedback (BUG, FEATURE_REQUEST, GENERAL, OTHER)
    """
    category: ProtoEnumValue!

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

    """
    Optional screenshot URL (client uploads to Cloudinary)
    """
    screenshotUrl: String
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
    submitFeedback(input: FeedbackInput!): EmptyResponse!
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
    ): Promise<GQLEmptyResponse> => {
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

      const screenshotUrl = input.screenshotUrl || null;

      // Create feedback record
      // CDC will pick this up and handle classification via PubSub
      const feedbackRepo = ctx.con.getRepository(Feedback);
      const feedback = await feedbackRepo.save({
        userId: ctx.userId,
        category: input.category,
        description: input.description.trim(),
        pageUrl: input.pageUrl || null,
        userAgent: input.userAgent || null,
        screenshotUrl,
        status: FeedbackStatus.Pending,
        flags: {},
      });

      // Create ContentImage record to link screenshot to feedback
      if (screenshotUrl) {
        await ctx.con.getRepository(ContentImage).save({
          url: screenshotUrl,
          serviceId: screenshotUrl,
          usedByType: ContentImageUsedByType.Feedback,
          usedById: feedback.id,
        });
      }

      return {
        _: true,
      };
    },
  },
});
