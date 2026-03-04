import { IResolvers } from '@graphql-tools/utils';
import { AuthContext, BaseContext } from '../Context';
import { Feedback, FeedbackStatus } from '../entity/Feedback';
import { FeedbackReply } from '../entity/FeedbackReply';
import { ContentImage, ContentImageUsedByType } from '../entity/ContentImage';
import { User } from '../entity/user/User';
import { ForbiddenError, ValidationError } from 'apollo-server-errors';
import type { Connection, ConnectionArguments } from 'graphql-relay';
import { In } from 'typeorm';
import type { z } from 'zod';
import {
  feedbackClientInfoSchema,
  feedbackInputSchema,
} from '../common/schema/feedback';
import { ZodError } from 'zod/v4';
import {
  connectionFromNodes,
  GQLEmptyResponse,
  offsetPageGenerator,
} from './common';
import { Roles } from '../roles';
import { queryReadReplica } from '../common/queryReadReplica';

type GQLFeedbackInput = {
  category: number;
  description: string;
  pageUrl?: string;
  userAgent?: string;
  clientInfo?: z.infer<typeof feedbackClientInfoSchema>;
  screenshotUrl?: string;
};

type GQLFeedbackReply = Pick<
  FeedbackReply,
  'id' | 'body' | 'authorName' | 'createdAt'
>;

type GQLFeedbackUser = Pick<User, 'id' | 'name' | 'username' | 'image'>;

type GQLFeedbackItem = Pick<
  Feedback,
  | 'id'
  | 'category'
  | 'description'
  | 'status'
  | 'screenshotUrl'
  | 'createdAt'
  | 'updatedAt'
> & {
  replies: GQLFeedbackReply[];
  user?: GQLFeedbackUser;
};

const feedbackPageGenerator = offsetPageGenerator<GQLFeedbackItem>(20, 50);

export const typeDefs = /* GraphQL */ `
  """
  Client environment info for debugging context
  """
  input FeedbackClientInfoInput {
    viewport: String
    screen: String
    timezone: String
    language: String
    platform: String
    theme: String
  }

  """
  Input for submitting user feedback
  """
  input FeedbackInput {
    """
    Category of feedback (BUG, FEATURE_REQUEST, GENERAL, OTHER, UX_ISSUE, PERFORMANCE, CONTENT_QUALITY)
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
    Structured client environment info for debugging context
    """
    clientInfo: FeedbackClientInfoInput

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

  type FeedbackReply {
    id: ID!
    body: String!
    authorName: String
    createdAt: DateTime!
  }

  type FeedbackUser {
    id: ID!
    name: String
    username: String
    image: String
  }

  type FeedbackItem {
    id: ID!
    category: ProtoEnumValue!
    description: String!
    status: Int!
    screenshotUrl: String
    createdAt: DateTime!
    updatedAt: DateTime!
    replies: [FeedbackReply!]!
    user: FeedbackUser
  }

  type FeedbackEdge {
    node: FeedbackItem!
    cursor: String!
  }

  type FeedbackConnection {
    pageInfo: PageInfo!
    edges: [FeedbackEdge!]!
  }

  extend type Query {
    """
    Get authenticated user's own feedback (cursor-paginated)
    """
    userFeedback(first: Int, after: String): FeedbackConnection! @auth

    """
    Get all feedback (moderator only, cursor-paginated, filterable)
    """
    feedbackList(
      first: Int
      after: String
      status: Int
      category: ProtoEnumValue
    ): FeedbackConnection! @auth
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

const mapRepliesByFeedbackId = ({
  replies,
}: {
  replies: FeedbackReply[];
}): Map<string, GQLFeedbackReply[]> => {
  const repliesByFeedbackId = new Map<string, GQLFeedbackReply[]>();

  for (const reply of replies) {
    const existing = repliesByFeedbackId.get(reply.feedbackId) ?? [];
    existing.push({
      id: reply.id,
      body: reply.body,
      authorName: reply.authorName,
      createdAt: reply.createdAt,
    });
    repliesByFeedbackId.set(reply.feedbackId, existing);
  }

  return repliesByFeedbackId;
};

export const resolvers: IResolvers<unknown, BaseContext> = {
  Query: {
    userFeedback: async (
      _,
      args: ConnectionArguments,
      ctx: AuthContext,
    ): Promise<Connection<GQLFeedbackItem>> => {
      const page = feedbackPageGenerator.connArgsToPage(args);

      const { nodes, total } = await queryReadReplica(
        ctx.con,
        async ({ queryRunner }) => {
          const [feedbackItems, feedbackTotal] = await queryRunner.manager
            .getRepository(Feedback)
            .findAndCount({
              where: { userId: ctx.userId },
              order: { createdAt: 'DESC' },
              take: page.limit,
              skip: page.offset,
            });

          const feedbackIds = feedbackItems.map((feedback) => feedback.id);
          const replies = feedbackIds.length
            ? await queryRunner.manager.getRepository(FeedbackReply).find({
                where: {
                  feedbackId: In(feedbackIds),
                },
                order: { createdAt: 'ASC' },
              })
            : [];

          const repliesByFeedbackId = mapRepliesByFeedbackId({ replies });

          return {
            nodes: feedbackItems.map((feedback) => ({
              id: feedback.id,
              category: feedback.category,
              description: feedback.description,
              status: feedback.status,
              screenshotUrl: feedback.screenshotUrl,
              createdAt: feedback.createdAt,
              updatedAt: feedback.updatedAt,
              replies: repliesByFeedbackId.get(feedback.id) ?? [],
            })),
            total: feedbackTotal,
          };
        },
      );

      return connectionFromNodes(
        args,
        nodes,
        undefined,
        page,
        feedbackPageGenerator,
        total,
      );
    },
    feedbackList: async (
      _,
      args: ConnectionArguments & { status?: number; category?: number },
      ctx: AuthContext,
    ): Promise<Connection<GQLFeedbackItem>> => {
      if (!ctx.roles.includes(Roles.Moderator)) {
        throw new ForbiddenError('Access denied!');
      }

      const page = feedbackPageGenerator.connArgsToPage(args);

      const where: Partial<Pick<Feedback, 'status' | 'category'>> = {};

      if (args.status !== undefined) {
        where.status = args.status;
      }

      if (args.category !== undefined) {
        where.category = args.category;
      }

      const { nodes, total } = await queryReadReplica(
        ctx.con,
        async ({ queryRunner }) => {
          const [feedbackItems, feedbackTotal] = await queryRunner.manager
            .getRepository(Feedback)
            .findAndCount({
              where,
              order: { createdAt: 'DESC' },
              take: page.limit,
              skip: page.offset,
            });

          const feedbackIds = feedbackItems.map((feedback) => feedback.id);
          const replies = feedbackIds.length
            ? await queryRunner.manager.getRepository(FeedbackReply).find({
                where: {
                  feedbackId: In(feedbackIds),
                },
                order: { createdAt: 'ASC' },
              })
            : [];

          const userIds = [
            ...new Set(feedbackItems.map((item) => item.userId)),
          ];
          const users = userIds.length
            ? await queryRunner.manager.getRepository(User).find({
                where: { id: In(userIds) },
                select: ['id', 'name', 'username', 'image'],
              })
            : [];

          const usersById = new Map(users.map((user) => [user.id, user]));
          const repliesByFeedbackId = mapRepliesByFeedbackId({ replies });

          return {
            nodes: feedbackItems.map((feedback) => ({
              id: feedback.id,
              category: feedback.category,
              description: feedback.description,
              status: feedback.status,
              screenshotUrl: feedback.screenshotUrl,
              createdAt: feedback.createdAt,
              updatedAt: feedback.updatedAt,
              replies: repliesByFeedbackId.get(feedback.id) ?? [],
              user: usersById.get(feedback.userId),
            })),
            total: feedbackTotal,
          };
        },
      );

      return connectionFromNodes(
        args,
        nodes,
        undefined,
        page,
        feedbackPageGenerator,
        total,
      );
    },
  },
  Mutation: {
    submitFeedback: async (
      _,
      { input }: { input: GQLFeedbackInput },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
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

      const feedbackRepo = ctx.con.getRepository(Feedback);
      const feedback = await feedbackRepo.save({
        userId: ctx.userId,
        category: input.category,
        description: input.description.trim(),
        pageUrl: input.pageUrl || null,
        userAgent: input.userAgent || null,
        clientInfo: input.clientInfo || null,
        screenshotUrl,
        status: FeedbackStatus.Pending,
        flags: {},
      });

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
};
