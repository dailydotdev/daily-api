import {
  cursorToOffset,
  offsetToCursor,
  type Connection,
  type ConnectionArguments,
} from 'graphql-relay';
import { IResolvers } from '@graphql-tools/utils';
import { BaseContext, Context, type AuthContext } from '../Context';
import { traceResolvers } from './trace';
import graphorm from '../graphorm';
import { CampaignState, CampaignType, type Campaign } from '../entity/campaign';
import type { GQLPost } from './posts';
import type { GQLSource } from './sources';
import { getLimit } from '../common';
import { type TransactionCreated } from '../common/njord';
import { startPostCampaign } from '../common/campaign/post';
import { StartCampaignArgs } from '../common/campaign/common';
import { ValidationError } from 'apollo-server-errors';
import { startSourceCampaign } from '../common/campaign/source';

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
          builder.queryBuilder.limit(getLimit({ limit: first ?? 20 }));

          if (after) {
            builder.queryBuilder.offset(offset);
          }

          return builder;
        },
      );
    },
  },
  Mutation: {
    startCampaign: async (
      _,
      args: Omit<StartCampaignArgs & { type: CampaignType }, 'userId'>,
      ctx: AuthContext,
    ): Promise<TransactionCreated> => {
      const { type } = args;

      switch (type) {
        case CampaignType.Post:
          return startPostCampaign({ ctx, args });
        case CampaignType.Source:
          return startSourceCampaign({ ctx, args });
        default:
          throw new ValidationError('Unknown type to process');
      }
    },
  },
});
