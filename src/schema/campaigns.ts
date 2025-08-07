import {
  cursorToOffset,
  offsetToCursor,
  type Connection,
  type ConnectionArguments,
} from 'graphql-relay';
import { IResolvers } from '@graphql-tools/utils';
import { AuthContext, BaseContext, Context } from '../Context';
import { traceResolvers } from './trace';

import graphorm from '../graphorm';
import { CampaignState, type Campaign } from '../entity/campaign';
import type { GQLPost } from './posts';
import type { GQLSource } from './sources';

interface GQLCampaign
  extends Pick<
    Campaign,
    'id' | 'type' | 'flags' | 'createdAt' | 'endedAt' | 'referenceId' | 'state'
  > {
  post: GQLPost;
  source: GQLSource;
}

export const typeDefs = /* GraphQL */ `
  type CampaignFlags {
    budget: Int!
    spend: Int!
    users: Int!
    clicks: Int!
    impressions: Int!
  }

  type Campaign {
    id: String!
    type: String!
    state: String!
    createdAt: DateTime!
    endedAt: DateTime!
    flags: CampaignFlags!
    post: Post
    source: Source
  }

  type CampaignEdge {
    node: Campaign!
    """
    Used in before and after args
    """
    cursor: String!
  }

  type CampaignConnection {
    pageInfo: PageInfo!
    edges: [CampaignEdge]!
  }

  extend type Query {
    campaignById(
      """
      ID of the campaign to fetch
      """
      id: ID!
    ): Campaign! @auth

    campaignsList(
      """
      Paginate after opaque cursor
      """
      after: String
      """
      Paginate first
      """
      first: Int
    ): CampaignConnection! @auth
  }
`;

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    campaignById: async (
      _,
      { id }: { id: string },
      ctx: Context,
      info,
    ): Promise<GQLCampaign> =>
      graphorm.queryOneOrFail(ctx, info, (builder) => {
        builder.queryBuilder.where({ id }).andWhere({ userId: ctx.userId });

        return builder;
      }),
    campaignsList: async (
      _,
      args: ConnectionArguments,
      ctx: AuthContext,
      info,
    ): Promise<Connection<GQLCampaign>> => {
      const { userId } = ctx;
      const { after, first = 20 } = args;
      const offset = after ? cursorToOffset(after) : 0;

      return graphorm.queryPaginated(
        ctx,
        info,
        () => !!after,
        (nodeSize) => nodeSize === first,
        (_, i) => offsetToCursor(offset + i + 1),
        (builder) => {
          const { alias } = builder;

          builder.queryBuilder.andWhere(`"${alias}"."userId" = :userId`, {
            userId,
          });

          builder.queryBuilder.orderBy(
            `CASE WHEN "${alias}"."state" = '${CampaignState.Active}' THEN 0 ELSE 1 END`,
          );
          builder.queryBuilder.addOrderBy(`"${alias}"."createdAt"`, 'DESC');
          builder.queryBuilder.limit(first ?? 20);

          if (after) {
            builder.queryBuilder.offset(offset);
          }

          return builder;
        },
      );
    },
  },
});
