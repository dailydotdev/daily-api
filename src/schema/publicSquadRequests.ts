import { ForbiddenError, UserInputError } from 'apollo-server-errors';
import { IResolvers } from '@graphql-tools/utils';
import {
  forwardPagination,
  PaginationResponse,
  offsetPageGenerator,
} from './common';
import { traceResolvers } from './trace';
import { Context } from '../Context';
import {
  SourceMember,
  SquadPublicRequest,
  SquadPublicRequestStatus,
  Source,
} from '../entity';
import { getRelayNodeInfo } from '../common';
import { GraphQLResolveInfo } from 'graphql';
import { SourceMemberRoles } from '../roles';
import { ConnectionArguments } from 'graphql-relay';
import { MoreThan } from 'typeorm';
import { ConflictError } from '../errors';

const REJECTED_DAYS_LIMIT = 14;

export interface GQLPublicSquadRequest {
  id: string;
  requestorId: string;
  sourceId: string;
  status: SquadPublicRequestStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface GQLPublicSquadRequestInput {
  sourceId: string;
}

interface SquadRequestsArgs
  extends ConnectionArguments,
    GQLPublicSquadRequestInput {}

export const typeDefs = /* GraphQL */ `
  """
  Request for making a squad public
  """
  type PublicSquadRequest {
    """
    Unique identifier
    """
    id: ID!

    """
    Id of the user who made the request
    """
    requestorId: String!

    """
    Request status
    """
    status: String!

    """
    Id for the squad
    """
    sourceId: String!

    """
    Time when the request was received
    """
    createdAt: DateTime!

    """
    Time of last update
    """
    updatedAt: DateTime!
  }

  type PublicSquadRequestConnection {
    pageInfo: PageInfo!
    edges: [PublicSquadRequestEdge!]!
  }

  type PublicSquadRequestEdge {
    node: PublicSquadRequest!

    """
    Used in \`before\` and \`after\` args
    """
    cursor: String!
  }

  extend type Mutation {
    """
    Request a new source
    """
    submitSquadForReview(sourceId: ID!): PublicSquadRequest!
      @auth(requires: [MODERATOR])
  }

  extend type Query {
    """
    Get all pending source requests
    """
    publicSquadRequests(
      """
      Paginate before opaque cursor
      """
      before: String

      """
      Paginate after opaque cursor
      """
      after: String

      """
      Paginate first
      """
      first: Int

      """
      Paginate last
      """
      last: Int

      """
      Squad ID
      """
      sourceId: String!
    ): PublicSquadRequestConnection! @auth(requires: [MODERATOR])
  }
`;

export const ensureSourceRole = async (
  ctx: Context,
  sourceId: string,
  role: SourceMemberRoles = SourceMemberRoles.Admin,
): Promise<Source> => {
  const source = await ctx.con
    .getRepository(Source)
    .findOneByOrFail([{ id: sourceId }, { handle: sourceId }]);
  const sourceMember = ctx.userId
    ? await ctx.con
        .getRepository(SourceMember)
        .findOneBy({ sourceId: source.id, userId: ctx.userId })
    : null;

  if (!sourceMember || sourceMember.role !== role) {
    throw new ForbiddenError('Access denied!');
  }

  return source;
};

const ensureNotRejected = async (
  ctx: Context,
  sourceId: string,
  lastDays = REJECTED_DAYS_LIMIT,
): Promise<void> => {
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - lastDays);
  const repo = ctx.getRepository(SquadPublicRequest);
  const lastRejected = await repo.findOne({
    where: {
      sourceId,
      status: SquadPublicRequestStatus.Rejected,
      updatedAt: MoreThan(daysAgo),
    },
  });

  if (lastRejected) {
    throw new ConflictError(
      `Public Squad request was rejected within the last ${lastDays} days!`,
    );
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolvers: IResolvers<any, Context> = traceResolvers({
  Mutation: {
    submitSquadForReview: async (
      _,
      { sourceId }: GQLPublicSquadRequestInput,
      ctx,
    ): Promise<GQLPublicSquadRequest> => {
      // we need to check that the user is squad admin, moderator is not enough
      const squad = await ensureSourceRole(
        ctx,
        sourceId,
        SourceMemberRoles.Admin,
      );

      // only create a request if squad is private
      if (!squad.private) {
        throw new UserInputError('Squad is already public!');
      }

      // make sure there is no rejected request within the last 14 days
      await ensureNotRejected(ctx, sourceId);

      const repo = ctx.getRepository(SquadPublicRequest);
      const publicReq = repo.create({
        requestorId: ctx.userId,
        sourceId,
        status: SquadPublicRequestStatus.Pending,
      });

      try {
        const result = await repo.save(publicReq);
        return result;
      } catch (err) {
        if (err.name === 'QueryFailedError' && err.code === '23505') {
          throw new ConflictError('Request already exists!');
        }
        throw err;
      }
    },
  },
  Query: {
    publicSquadRequests: forwardPagination(
      async (
        _,
        args: SquadRequestsArgs,
        ctx,
        { limit, offset },
        info: GraphQLResolveInfo,
      ): Promise<PaginationResponse<GQLPublicSquadRequest>> => {
        // we need to check that the user is squad admin, moderator is not enough
        await ensureSourceRole(ctx, args.sourceId, SourceMemberRoles.Admin);

        const [rows, total] =
          await ctx.loader.loadManyPaginated<SquadPublicRequest>(
            SquadPublicRequest,
            { sourceId: args.sourceId },
            getRelayNodeInfo(info),
            {
              limit,
              offset,
            },
            { order: { '"createdAt"': 'DESC' } },
          );
        return {
          total,
          nodes: rows,
        };
      },
      offsetPageGenerator(100, 500),
    ),
  },
});
