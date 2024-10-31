import { IResolvers } from '@graphql-tools/utils';
import { traceResolvers } from './trace';
import { AuthContext, BaseContext } from '../Context';
import { ContentPreference } from '../entity/contentPreference/ContentPreference';
import { MAX_FOLLOWERS_LIMIT, toGQLEnum } from '../common';
import {
  ContentPreferenceStatus,
  ContentPreferenceType,
} from '../entity/contentPreference/types';
import { followEntity, unfollowEntity } from '../common/contentPreference';
import { GQLEmptyResponse, offsetPageGenerator } from './common';
import graphorm from '../graphorm';
import { Connection, ConnectionArguments } from 'graphql-relay';
import { In, Not } from 'typeorm';
import { ConflictError } from '../errors';

export type GQLContentPreference = Pick<
  ContentPreference,
  'referenceId' | 'userId' | 'type' | 'createdAt' | 'status'
>;

export const typeDefs = /* GraphQL */ `
  ${toGQLEnum(ContentPreferenceType, 'ContentPreferenceType')}

  ${toGQLEnum(ContentPreferenceStatus, 'ContentPreferenceStatus')}

  enum FollowStatus {
    follow
    subscribed
  }

  type ContentPreference {
    referenceId: ID!

    user: User!

    referenceUser: User!

    type: ContentPreferenceType!

    createdAt: DateTime!

    status: ContentPreferenceStatus!
  }

  type ContentPreferenceEdge {
    node: ContentPreference!

    """
    Used in \`before\` and \`after\` args
    """
    cursor: String!
  }

  type ContentPreferenceConnection {
    pageInfo: PageInfo!
    edges: [ContentPreferenceEdge!]!
  }

  extend type Query {
    """
    Content preference status
    """
    contentPreferenceStatus(
      """
      Id of the entity
      """
      id: ID!
      """
      Entity type (user, source..)
      """
      entity: ContentPreferenceType!
    ): ContentPreference @auth

    """
    Who follows user
    """
    userFollowers(
      """
      Id of user
      """
      userId: ID!
      """
      Entity to list (user, source..)
      """
      entity: ContentPreferenceType!
      """
      Paginate after opaque cursor
      """
      after: String
      """
      Paginate first
      """
      first: Int
    ): ContentPreferenceConnection!

    """
    What user follows
    """
    userFollowing(
      """
      Id of user
      """
      userId: ID!
      """
      Entity to list (user, source..)
      """
      entity: ContentPreferenceType!
      """
      Paginate after opaque cursor
      """
      after: String
      """
      Paginate first
      """
      first: Int
    ): ContentPreferenceConnection!
  }

  extend type Mutation {
    """
    Follow entity
    """
    follow(
      """
      Id of the entity
      """
      id: ID!
      """
      Entity to follow (user, source..)
      """
      entity: ContentPreferenceType!
      """
      Follow status
      """
      status: FollowStatus!
    ): EmptyResponse @auth
    """
    Unfollow entity
    """
    unfollow(
      """
      Id of the entity
      """
      id: ID!
      """
      Entity unfollow (user, source..)
      """
      entity: ContentPreferenceType!
    ): EmptyResponse @auth
  }
`;

const contentPreferencePageGenerator =
  offsetPageGenerator<GQLContentPreference>(10, 50);

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    contentPreferenceStatus: async (
      _,
      args: { id: string; entity: ContentPreferenceType },
      ctx: AuthContext,
      info,
    ): Promise<GQLContentPreference | null> => {
      return graphorm.queryOneOrFail<GQLContentPreference>(
        ctx,
        info,
        (builder) => ({
          ...builder,
          queryBuilder: builder.queryBuilder
            .where(`"${builder.alias}"."userId" = :userId`, {
              userId: ctx.userId,
            })
            .andWhere(`"${builder.alias}"."type" = :type`, {
              type: args.entity,
            })
            .andWhere(`"${builder.alias}"."referenceId" = :id`, {
              id: args.id,
            }),
        }),
      );
    },
    userFollowers: async (
      _,
      args: {
        userId: string;
        entity: ContentPreferenceType;
      } & ConnectionArguments,
      ctx: AuthContext,
      info,
    ): Promise<Connection<GQLContentPreference>> => {
      const page = contentPreferencePageGenerator.connArgsToPage(args);

      return graphorm.queryPaginated(
        ctx,
        info,
        (nodeSize) =>
          contentPreferencePageGenerator.hasPreviousPage(page, nodeSize),
        (nodeSize) =>
          contentPreferencePageGenerator.hasNextPage(page, nodeSize),
        (node, index) =>
          contentPreferencePageGenerator.nodeToCursor(page, args, node, index),
        (builder) => {
          builder.queryBuilder = builder.queryBuilder
            .where(`${builder.alias}."referenceId" = :userId`, {
              userId: args.userId,
            })
            .andWhere(`${builder.alias}."type" = :type`, {
              type: args.entity,
            })
            .limit(page.limit)
            .offset(page.offset)
            .addOrderBy(`${builder.alias}."createdAt"`, 'DESC');

          return builder;
        },
        undefined,
        true,
      );
    },
    userFollowing: async (
      _,
      args: {
        userId: string;
        entity: ContentPreferenceType;
      } & ConnectionArguments,
      ctx: AuthContext,
      info,
    ): Promise<Connection<GQLContentPreference>> => {
      const page = contentPreferencePageGenerator.connArgsToPage(args);

      return graphorm.queryPaginated(
        ctx,
        info,
        (nodeSize) =>
          contentPreferencePageGenerator.hasPreviousPage(page, nodeSize),
        (nodeSize) =>
          contentPreferencePageGenerator.hasNextPage(page, nodeSize),
        (node, index) =>
          contentPreferencePageGenerator.nodeToCursor(page, args, node, index),
        (builder) => {
          builder.queryBuilder = builder.queryBuilder
            .where(`${builder.alias}."userId" = :userId`, {
              userId: args.userId,
            })
            .andWhere(`${builder.alias}."type" = :type`, {
              type: args.entity,
            })
            .limit(page.limit)
            .offset(page.offset)
            .addOrderBy(`${builder.alias}."createdAt"`, 'DESC');

          return builder;
        },
        undefined,
        true,
      );
    },
  },
  Mutation: {
    follow: async (
      _,
      {
        id,
        entity,
        status,
      }: {
        id: string;
        entity: ContentPreferenceType;
        status:
          | ContentPreferenceStatus.Follow
          | ContentPreferenceStatus.Subscribed;
      },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const followersCount = await ctx.con
        .getRepository(ContentPreference)
        .countBy({
          userId: ctx.userId,
          status: In([
            ContentPreferenceStatus.Follow,
            ContentPreferenceStatus.Subscribed,
          ]),
          type: Not(ContentPreferenceType.Keyword),
        });

      if (followersCount >= MAX_FOLLOWERS_LIMIT) {
        throw new ConflictError('Max followers limit reached');
      }

      await followEntity({ ctx, id, entity, status });

      return {
        _: true,
      };
    },
    unfollow: async (
      _,
      { id, entity }: { id: string; entity: ContentPreferenceType },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      await unfollowEntity({ ctx, id, entity });

      return {
        _: true,
      };
    },
  },
});
