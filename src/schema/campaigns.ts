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
import { Campaign, CampaignState, CampaignType } from '../entity/campaign';
import type { GQLPost } from './posts';
import type { GQLSource } from './sources';
import { getLimit } from '../common';
import { type TransactionCreated } from '../common/njord';
import { startCampaignPost } from '../common/campaign/post';
import {
  StartCampaignArgs,
  stopCampaign,
  typeToCancelFn,
} from '../common/campaign/common';
import { ValidationError } from 'apollo-server-errors';
import { startCampaignSource } from '../common/campaign/source';

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

  extend type Mutation {
    """
    Start a campaign for a post or source
    """
    startCampaign(
      """
      Type of campaign (post or source)
      """
      type: String!
      """
      ID of the post or source to promote
      """
      value: ID!
      """
      Duration of the campaign in days (1-30)
      """
      duration: Int!
      """
      Budget for the campaign in cores (1000-100000, must be divisible by 1000)
      """
      budget: Int!
    ): TransactionCreated @auth

    """
    Stop an existing campaign
    """
    stopCampaign(
      """
      ID of the campaign to stop
      """
      campaignId: ID!
    ): TransactionCreated @auth
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
          return startCampaignPost({ ctx, args });
        case CampaignType.Source:
          return startCampaignSource({ ctx, args });
        default:
          throw new ValidationError('Unknown type to process');
      }
    },
    stopCampaign: async (
      _,
      args: Omit<{ campaignId: string }, 'userId'>,
      ctx: AuthContext,
    ): Promise<TransactionCreated> => {
      const campaign = await ctx.con.getRepository(Campaign).findOneOrFail({
        where: { id: args.campaignId, userId: ctx.userId },
      });

      const onCancelledFn = typeToCancelFn[campaign.type];

      if (!onCancelledFn) {
        throw new ValidationError('Unknown campaign type to cancel');
      }

      if (campaign.state !== CampaignState.Active) {
        throw new ValidationError('Campaign is not active');
      }

      return ctx.con.transaction(async (manager) => {
        const result = await stopCampaign({
          ctx,
          campaign,
          manager,
          onCancelled: () => onCancelledFn(manager, campaign.referenceId),
        });

        return result.transaction;
      });
    },
  },
});
