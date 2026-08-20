import { IResolvers } from '@graphql-tools/utils';
import { ForbiddenError, ValidationError } from 'apollo-server-errors';
import { AuthContext, BaseContext } from '../Context';
import graphorm from '../graphorm';
import { Feed, FeedOrigin } from '../entity/Feed';
import { AgentSource } from '../entity/Source';
import { InterestFeedback } from '../entity/InterestFeedback';
import {
  InterestRun,
  InterestRunStatus,
  InterestRunTrigger,
  type InterestRunBlock,
} from '../entity/InterestRun';
import {
  UserInterest,
  UserInterestCadence,
  UserInterestStatus,
  type UserInterestOutputModes,
  type UserInterestSources,
  defaultUserInterestOutputModes,
  defaultUserInterestSources,
} from '../entity/UserInterest';
import { NotFoundError } from '../errors';
import { generateShortId } from '../ids';
import { triggerTypedEvent } from '../common/typedPubsub';
import { queryReadReplica } from '../common/queryReadReplica';
import { whereFindingDeliverable } from '../common/interest/exclusions';
import { GQLEmptyResponse } from './common';
import type { GQLPost } from './posts';
import { PostType } from '../entity/posts/Post';
import {
  createInterestSchema,
  interestHistorySchema,
  interestIdSchema,
  sendInterestCommandSchema,
  updateInterestSchema,
} from '../common/schema/interests';

export type GQLUserInterest = Pick<
  UserInterest,
  | 'id'
  | 'query'
  | 'title'
  | 'status'
  | 'cadence'
  | 'fomoThreshold'
  | 'sources'
  | 'outputModes'
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

export type GQLInterestTurn = {
  id: string;
  role: 'user' | 'agent';
  createdAt: Date;
  text?: string | null;
  status?: string | null;
  trigger?: string | null;
  feedbackId?: string | null;
  blocks?: InterestRunBlock[] | null;
  findingsAdded?: number | null;
  summaryPostId?: string | null;
  progress?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
};

export const typeDefs = /* GraphQL */ `
  """
  A long-lived interest the agent hunts content for
  """
  type UserInterest {
    id: ID!
    query: String!
    title: String
    status: String!
    cadence: String!
    fomoThreshold: Float!
    sources: JSONObject!
    outputModes: JSONObject!
    feedId: String
    sourceId: String
    lastRunAt: DateTime
    lastRunSummary: String
    lastRunStatus: String
    lastRunFindings: Int
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

  """
  One turn in an interest's conversation history: a user command (role user)
  or an agent run (role agent)
  """
  type InterestTurn {
    id: ID!
    role: String!
    createdAt: DateTime!
    text: String
    status: String
    trigger: String
    feedbackId: String
    blocks: [JSONObject!]
    findingsAdded: Int
    summaryPostId: String
    progress: String
    startedAt: DateTime
    finishedAt: DateTime
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

    """
    Get the generated posts hosted in an interest's source
    """
    interestPosts(id: ID!): [Post!]! @auth

    """
    Get the merged conversation history of an interest: user commands and
    agent runs, oldest first. Returns the newest turns up to limit; page
    older turns by passing the oldest received turn's cursor
    ("<createdAt>|<role>|<id>") as before.
    """
    interestHistory(id: ID!, limit: Int, before: String): [InterestTurn!]! @auth
  }

  input InterestSourcesInput {
    dailyDev: Boolean
    web: Boolean
    github: Boolean
  }

  input InterestOutputModesInput {
    feed: Boolean
    post: Boolean
    digest: Boolean
    notification: Boolean
  }

  input UpdateInterestInput {
    status: String
    cadence: String
    fomoThreshold: Float
    sources: InterestSourcesInput
    outputModes: InterestOutputModesInput
  }

  input CreateInterestSettingsInput {
    cadence: String
    fomoThreshold: Float
    sources: InterestSourcesInput
    outputModes: InterestOutputModesInput
  }

  extend type Mutation {
    """
    Spawn a new interest and trigger its first hunt
    """
    createInterest(
      query: String!
      settings: CreateInterestSettingsInput
    ): UserInterest! @auth

    """
    Update an interest's status, cadence, FOMO threshold, sources, or output modes
    """
    updateInterest(id: ID!, data: UpdateInterestInput!): UserInterest! @auth

    """
    Delete an interest and its findings
    """
    deleteInterest(id: ID!): EmptyResponse! @auth

    """
    Send a natural-language command to an interest (records feedback and,
    unless triggerRun is false, re-triggers a run)
    """
    sendInterestCommand(
      id: ID!
      text: String!
      triggerRun: Boolean
    ): UserInterest! @auth
  }
`;

const ensureTeamMember = (ctx: AuthContext): void => {
  if (!ctx.isTeamMember) {
    throw new ForbiddenError('Interest agent is not available');
  }
};

const DEFAULT_HISTORY_LIMIT = 100;

const turnRank = { user: 0, agent: 1 } as const;

const compareTurnsAsc = (
  a: Pick<GQLInterestTurn, 'id' | 'role' | 'createdAt'>,
  b: Pick<GQLInterestTurn, 'id' | 'role' | 'createdAt'>,
): number => {
  const diff = a.createdAt.getTime() - b.createdAt.getTime();
  if (diff !== 0) {
    return diff;
  }
  if (a.role !== b.role) {
    return turnRank[a.role] - turnRank[b.role];
  }
  if (a.id === b.id) {
    return 0;
  }
  return a.id < b.id ? -1 : 1;
};

export const resolvers: IResolvers<unknown, BaseContext> = {
  Query: {
    interests: async (
      _,
      args: Record<string, never>,
      ctx: AuthContext,
      info,
    ): Promise<GQLUserInterest[]> => {
      ensureTeamMember(ctx);
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
      ensureTeamMember(ctx);
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
      ensureTeamMember(ctx);
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
          builder.queryBuilder = whereFindingDeliverable(
            builder.queryBuilder.where(`${builder.alias}."interestId" = :id`, {
              id,
            }),
            builder.alias,
          ).orderBy(`${builder.alias}.score`, 'DESC');
          return builder;
        },
        true,
      );
    },
    interestPosts: async (
      _,
      args: { id: string },
      ctx: AuthContext,
      info,
    ): Promise<GQLPost[]> => {
      ensureTeamMember(ctx);
      const { id } = interestIdSchema.parse(args);

      const interest = await queryReadReplica(ctx.con, ({ queryRunner }) =>
        queryRunner.manager.getRepository(UserInterest).findOne({
          select: ['sourceId'],
          where: { id, userId: ctx.userId },
        }),
      );

      if (!interest) {
        throw new NotFoundError('Interest not found');
      }

      if (!interest.sourceId) {
        return [];
      }

      return graphorm.query<GQLPost>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder = builder.queryBuilder
            .where(`${builder.alias}."sourceId" = :sourceId`, {
              sourceId: interest.sourceId,
            })
            .andWhere(`${builder.alias}.type = :type`, {
              type: PostType.Freeform,
            })
            .andWhere(`${builder.alias}.deleted = false`)
            .orderBy(`${builder.alias}."createdAt"`, 'DESC');
          return builder;
        },
        true,
      );
    },
    interestHistory: async (
      _,
      args: { id: string; limit?: number; before?: string },
      ctx: AuthContext,
    ): Promise<GQLInterestTurn[]> => {
      ensureTeamMember(ctx);
      const { id, limit, before } = interestHistorySchema.parse(args);
      const take = limit ?? DEFAULT_HISTORY_LIMIT;

      let cursor: { createdAt: Date; rank: number; id: string } | null = null;
      if (before) {
        const [iso, rank, cursorId] = before.split('|');
        const createdAt = new Date(iso);
        if (
          Number.isNaN(createdAt.getTime()) ||
          !(rank in turnRank) ||
          !cursorId
        ) {
          throw new ValidationError('Invalid history cursor');
        }
        cursor = {
          createdAt,
          rank: turnRank[rank as keyof typeof turnRank],
          id: cursorId,
        };
      }

      const interest = await queryReadReplica(ctx.con, ({ queryRunner }) =>
        queryRunner.manager.getRepository(UserInterest).findOne({
          select: ['id', 'query', 'createdAt'],
          where: { id, userId: ctx.userId },
        }),
      );

      if (!interest) {
        throw new NotFoundError('Interest not found');
      }

      const [feedback, runs] = await queryReadReplica(
        ctx.con,
        ({ queryRunner }) => {
          const feedbackBuilder = queryRunner.manager
            .getRepository(InterestFeedback)
            .createQueryBuilder('fb')
            .select(['fb.id', 'fb.text', 'fb.createdAt'])
            .where('fb."interestId" = :id', { id })
            .orderBy('fb."createdAt"', 'DESC')
            .addOrderBy('fb.id', 'DESC')
            .limit(take);
          const runsBuilder = queryRunner.manager
            .getRepository(InterestRun)
            .createQueryBuilder('r')
            .where('r."interestId" = :id', { id })
            .orderBy('r."createdAt"', 'DESC')
            .addOrderBy('r.id', 'DESC')
            .limit(take);

          if (cursor) {
            const params = {
              cursorAt: cursor.createdAt,
              cursorRank: cursor.rank,
              cursorId: cursor.id,
            };
            feedbackBuilder.andWhere(
              `(fb."createdAt", ${turnRank.user}, fb.id) < (:cursorAt, :cursorRank, :cursorId)`,
              params,
            );
            runsBuilder.andWhere(
              `(r."createdAt", ${turnRank.agent}, r.id) < (:cursorAt, :cursorRank, :cursorId)`,
              params,
            );
          }

          return Promise.all([
            feedbackBuilder.getMany(),
            runsBuilder.getMany(),
          ]);
        },
      );

      const merged: GQLInterestTurn[] = [
        ...feedback.map(
          (row): GQLInterestTurn => ({
            id: row.id,
            role: 'user',
            text: row.text,
            createdAt: row.createdAt,
          }),
        ),
        ...runs.map(
          (run): GQLInterestTurn => ({
            id: run.id,
            role: 'agent',
            createdAt: run.createdAt,
            status: run.status,
            trigger: run.trigger,
            feedbackId: run.feedbackId,
            blocks: run.blocks,
            findingsAdded: run.findingsAdded,
            summaryPostId: run.summaryPostId,
            progress: run.progress,
            startedAt: run.startedAt,
            finishedAt: run.finishedAt,
          }),
        ),
      ].sort(compareTurnsAsc);

      const page = merged.slice(-take);
      const spawnTurn: GQLInterestTurn = {
        id: `${interest.id}-spawn`,
        role: 'user',
        text: interest.query,
        createdAt: interest.createdAt,
      };
      const reachedStart =
        merged.length < take &&
        (!cursor ||
          compareTurnsAsc(spawnTurn, {
            id: cursor.id,
            role: cursor.rank === turnRank.user ? 'user' : 'agent',
            createdAt: cursor.createdAt,
          }) < 0);

      return reachedStart ? [spawnTurn, ...page] : page;
    },
  },
  Mutation: {
    createInterest: async (
      _,
      args: { query: string; settings?: unknown },
      ctx: AuthContext,
      info,
    ): Promise<GQLUserInterest> => {
      ensureTeamMember(ctx);
      const { query, settings } = createInterestSchema.parse(args);
      const { userId } = ctx;

      const interestId = await generateShortId();
      const sourceId = await generateShortId();
      const feedId = await generateShortId();
      const runId = await generateShortId();

      await ctx.con.transaction(async (manager) => {
        await manager.getRepository(AgentSource).save({
          id: sourceId,
          name: query.slice(0, 100),
          handle: `agent-${sourceId}`,
          private: true,
        });

        await manager.getRepository(Feed).save({
          id: feedId,
          userId,
          flags: { name: query.slice(0, 100), origin: FeedOrigin.Agent },
        });

        await manager.getRepository(UserInterest).save({
          id: interestId,
          userId,
          query,
          status: UserInterestStatus.Active,
          cadence: settings?.cadence ?? UserInterestCadence.Hourly,
          sources: {
            ...defaultUserInterestSources,
            ...settings?.sources,
          },
          outputModes: {
            ...defaultUserInterestOutputModes,
            ...settings?.outputModes,
          },
          ...(typeof settings?.fomoThreshold !== 'undefined' && {
            fomoThreshold: settings.fomoThreshold,
          }),
          feedId,
          sourceId,
        });

        await manager.getRepository(InterestRun).insert({
          id: runId,
          interestId,
          status: InterestRunStatus.Queued,
          trigger: InterestRunTrigger.Spawn,
        });
      });

      await triggerTypedEvent(ctx.log, 'api.v1.interest-run-requested', {
        interestId,
        runId,
      });

      return graphorm.queryOneOrFail<GQLUserInterest>(ctx, info, (builder) => {
        builder.queryBuilder = builder.queryBuilder.where(
          `${builder.alias}.id = :id`,
          { id: interestId },
        );
        return builder;
      });
    },
    updateInterest: async (
      _,
      args: {
        id: string;
        data: unknown;
      },
      ctx: AuthContext,
      info,
    ): Promise<GQLUserInterest> => {
      ensureTeamMember(ctx);
      const { id } = interestIdSchema.parse({ id: args.id });
      const data = updateInterestSchema.parse(args.data);
      const { userId } = ctx;

      const interest = await ctx.con.getRepository(UserInterest).findOne({
        where: { id, userId },
      });

      if (!interest) {
        throw new NotFoundError('Interest not found');
      }

      const update: Partial<UserInterest> = {};
      if (data.status !== undefined) {
        update.status = data.status;
      }
      if (typeof data.cadence !== 'undefined') {
        update.cadence = data.cadence;
      }
      if (data.fomoThreshold !== undefined) {
        update.fomoThreshold = data.fomoThreshold;
      }
      if (data.sources) {
        update.sources = {
          ...interest.sources,
          ...data.sources,
        } as UserInterestSources;
      }
      if (data.outputModes) {
        update.outputModes = {
          ...interest.outputModes,
          ...data.outputModes,
        } as UserInterestOutputModes;
      }

      if (Object.keys(update).length) {
        await ctx.con.getRepository(UserInterest).update({ id }, update);
      }

      return graphorm.queryOneOrFail<GQLUserInterest>(ctx, info, (builder) => {
        builder.queryBuilder = builder.queryBuilder.where(
          `${builder.alias}.id = :id`,
          { id },
        );
        return builder;
      });
    },
    deleteInterest: async (
      _,
      args: { id: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      ensureTeamMember(ctx);
      const { id } = interestIdSchema.parse(args);
      const { userId } = ctx;

      const interest = await ctx.con.getRepository(UserInterest).findOne({
        where: { id, userId },
      });

      if (!interest) {
        throw new NotFoundError('Interest not found');
      }

      await ctx.con.transaction(async (manager) => {
        await manager.getRepository(UserInterest).delete({ id });
        if (interest.feedId) {
          await manager.getRepository(Feed).delete({ id: interest.feedId });
        }
        if (interest.sourceId) {
          await manager
            .getRepository(AgentSource)
            .delete({ id: interest.sourceId });
        }
      });

      return { _: true };
    },
    sendInterestCommand: async (
      _,
      args: { id: string; text: string; triggerRun?: boolean },
      ctx: AuthContext,
      info,
    ): Promise<GQLUserInterest> => {
      ensureTeamMember(ctx);
      const { id, text, triggerRun } = sendInterestCommandSchema.parse(args);
      const { userId } = ctx;

      const interest = await ctx.con.getRepository(UserInterest).findOne({
        select: ['id'],
        where: { id, userId },
      });

      if (!interest) {
        throw new NotFoundError('Interest not found');
      }

      const feedbackId = await generateShortId();
      const runId = await generateShortId();
      const shouldRun = triggerRun !== false;

      await ctx.con.transaction(async (manager) => {
        await manager.getRepository(InterestFeedback).insert({
          id: feedbackId,
          interestId: id,
          text,
        });

        if (shouldRun) {
          await manager.getRepository(InterestRun).insert({
            id: runId,
            interestId: id,
            status: InterestRunStatus.Queued,
            trigger: InterestRunTrigger.Command,
            feedbackId,
          });
        }
      });

      if (shouldRun) {
        await triggerTypedEvent(ctx.log, 'api.v1.interest-run-requested', {
          interestId: id,
          runId,
        });
      }

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
