import { IResolvers } from '@graphql-tools/utils';
import { ValidationError } from 'apollo-server-errors';
import { AuthContext, BaseContext } from '../Context';
import graphorm from '../graphorm';
import { Feed } from '../entity/Feed';
import { InterestSource } from '../entity/Source';
import {
  UserInterest,
  UserInterestStatus,
  defaultUserInterestOutputModes,
  defaultUserInterestSources,
} from '../entity/UserInterest';
import { NotFoundError } from '../errors';
import { generateShortId } from '../ids';
import { triggerTypedEvent } from '../common/typedPubsub';
import { queryReadReplica } from '../common/queryReadReplica';
import {
  createInterestSchema,
  interestIdSchema,
  sendInterestCommandSchema,
} from '../common/schema/interests';

export type GQLUserInterest = Pick<
  UserInterest,
  | 'id'
  | 'query'
  | 'status'
  | 'feedId'
  | 'sourceId'
  | 'lastRunAt'
  | 'lastRunSummary'
  | 'createdAt'
  | 'updatedAt'
>;

export type GQLInterestFinding = {
  id: string;
  interestId: string;
  postId: string;
  score: number;
  rationale?: string | null;
  status: string;
  createdAt: Date;
};

export const typeDefs = /* GraphQL */ `
  """
  A long-lived interest the agent hunts content for
  """
  type UserInterest {
    id: ID!
    query: String!
    status: String!
    feedId: String
    sourceId: String
    lastRunAt: DateTime
    lastRunSummary: String
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  """
  A scored piece of content the agent surfaced for an interest
  """
  type InterestFinding {
    id: ID!
    interestId: String!
    postId: String!
    score: Float!
    rationale: String
    status: String!
    post: Post
    createdAt: DateTime!
  }

  extend type Query {
    """
    List the interests owned by the current user
    """
    interests: [UserInterest!]! @auth

    """
    Get a single interest owned by the current user
    """
    interest(id: ID!): UserInterest @auth

    """
    Get the findings (feed view) for an interest owned by the current user
    """
    interestFindings(id: ID!): [InterestFinding!]! @auth
  }

  extend type Mutation {
    """
    Spawn a new interest and trigger its first hunt
    """
    createInterest(query: String!): UserInterest! @auth

    """
    Send a natural-language command to an interest (P0: re-triggers a run)
    """
    sendInterestCommand(id: ID!, text: String!): UserInterest! @auth
  }
`;

export const resolvers: IResolvers<unknown, BaseContext> = {
  Query: {
    interests: async (
      _,
      args: Record<string, never>,
      ctx: AuthContext,
      info,
    ): Promise<GQLUserInterest[]> => {
      return graphorm.query<GQLUserInterest>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder = builder.queryBuilder
            .where(`${builder.alias}."userId" = :userId`, {
              userId: ctx.userId,
            })
            .orderBy(`${builder.alias}."createdAt"`, 'DESC');
          return builder;
        },
        true,
      );
    },
    interest: async (
      _,
      args: { id: string },
      ctx: AuthContext,
      info,
    ): Promise<GQLUserInterest | null> => {
      const { id } = interestIdSchema.parse(args);

      return graphorm.queryOne<GQLUserInterest>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder = builder.queryBuilder.where(
            `${builder.alias}.id = :id AND ${builder.alias}."userId" = :userId`,
            { id, userId: ctx.userId },
          );
          return builder;
        },
        true,
      );
    },
    interestFindings: async (
      _,
      args: { id: string },
      ctx: AuthContext,
      info,
    ): Promise<GQLInterestFinding[]> => {
      const { id } = interestIdSchema.parse(args);

      const interest = await queryReadReplica(ctx.con, ({ queryRunner }) =>
        queryRunner.manager.getRepository(UserInterest).findOne({
          select: ['id'],
          where: { id, userId: ctx.userId },
        }),
      );

      if (!interest) {
        throw new NotFoundError('Interest not found');
      }

      return graphorm.query<GQLInterestFinding>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder = builder.queryBuilder
            .where(`${builder.alias}."interestId" = :id`, { id })
            .orderBy(`${builder.alias}.score`, 'DESC');
          return builder;
        },
        true,
      );
    },
  },
  Mutation: {
    createInterest: async (
      _,
      args: { query: string },
      ctx: AuthContext,
      info,
    ): Promise<GQLUserInterest> => {
      const { query } = createInterestSchema.parse(args);
      const { userId } = ctx;

      const interestId = await generateShortId();
      const sourceId = await generateShortId();
      const feedId = await generateShortId();

      await ctx.con.transaction(async (manager) => {
        await manager.getRepository(InterestSource).save({
          id: sourceId,
          name: query.slice(0, 100),
          handle: `interest-${sourceId}`,
          private: true,
          userId,
        });

        await manager.getRepository(Feed).save({
          id: feedId,
          userId,
          flags: { name: query.slice(0, 100) },
        });

        await manager.getRepository(UserInterest).save({
          id: interestId,
          userId,
          query,
          status: UserInterestStatus.Active,
          sources: defaultUserInterestSources,
          outputModes: defaultUserInterestOutputModes,
          feedId,
          sourceId,
        });
      });

      await triggerTypedEvent(ctx.log, 'api.v1.interest-run-requested', {
        interestId,
      });

      return graphorm.queryOneOrFail<GQLUserInterest>(ctx, info, (builder) => {
        builder.queryBuilder = builder.queryBuilder.where(
          `${builder.alias}.id = :id`,
          { id: interestId },
        );
        return builder;
      });
    },
    sendInterestCommand: async (
      _,
      args: { id: string; text: string },
      ctx: AuthContext,
      info,
    ): Promise<GQLUserInterest> => {
      const { id } = sendInterestCommandSchema.parse(args);
      const { userId } = ctx;

      const interest = await ctx.con.getRepository(UserInterest).findOne({
        select: ['id'],
        where: { id, userId },
      });

      if (!interest) {
        throw new NotFoundError('Interest not found');
      }

      await triggerTypedEvent(ctx.log, 'api.v1.interest-run-requested', {
        interestId: id,
      });

      return graphorm.queryOneOrFail<GQLUserInterest>(ctx, info, (builder) => {
        builder.queryBuilder = builder.queryBuilder.where(
          `${builder.alias}.id = :id`,
          { id },
        );
        return builder;
      });
    },
  },
};
