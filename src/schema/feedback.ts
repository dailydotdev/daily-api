import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { AuthContext, BaseContext } from '../Context';
import { Feedback, FeedbackStatus } from '../entity/Feedback';
import { ContentImage, ContentImageUsedByType } from '../entity/ContentImage';
import { ValidationError } from 'apollo-server-errors';
import { feedbackInputSchema } from '../common/schema/feedback';
import { ZodError } from 'zod/v4';
import { GQLEmptyResponse } from './common';
import { uploadPostFile, UploadPreset } from '../common/cloudinary';
import { generateUUID } from '../ids';
// @ts-expect-error - no types
import { FileUpload } from 'graphql-upload/GraphQLUpload.js';

interface GQLFeedbackInput {
  category: number;
  description: string;
  pageUrl?: string;
  userAgent?: string;
  screenshot?: Promise<FileUpload>;
  consoleLogs?: string;
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
    Optional screenshot image upload
    """
    screenshot: Upload

    """
    Optional console logs as JSON string (max 50KB)
    """
    consoleLogs: String
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

      let screenshotUrl: string | null = null;
      let screenshotId: string | null = null;

      // Handle screenshot upload
      if (input.screenshot && process.env.CLOUDINARY_URL) {
        const upload = await input.screenshot;
        const extension = upload.filename?.split('.').pop()?.toLowerCase();

        // Validate image type
        const allowedExtensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
        if (!extension || !allowedExtensions.includes(extension)) {
          throw new ValidationError(
            'Invalid screenshot format. Allowed: png, jpg, jpeg, webp, gif',
          );
        }

        const id = generateUUID();
        const filename = `feedback_${id}`;
        const preset =
          extension === 'gif'
            ? UploadPreset.FreeformGif
            : UploadPreset.FreeformImage;

        const uploadResult = await uploadPostFile(
          filename,
          upload.createReadStream(),
          preset,
        );
        screenshotUrl = uploadResult.url;
        screenshotId = uploadResult.id;
      }

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
        screenshotId,
        consoleLogs: input.consoleLogs || null,
        status: FeedbackStatus.Pending,
        flags: {},
      });

      // Create ContentImage record to link screenshot to feedback
      if (screenshotUrl && screenshotId) {
        await ctx.con.getRepository(ContentImage).save({
          url: screenshotUrl,
          serviceId: screenshotId,
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
