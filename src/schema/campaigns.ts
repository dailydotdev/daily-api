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
import { getLimit, toGQLEnum } from '../common';
import { type TransactionCreated } from '../common/njord';
import {
  getAdjustedReach,
  startCampaignPost,
  stopCampaignPost,
  validatePostBoostPermissions,
} from '../common/campaign/post';
import {
  getReferenceTags,
  getUserCampaignStats,
  StartCampaignArgs,
  validateCampaignArgs,
  type UserCampaignStats,
} from '../common/campaign/common';
import { ValidationError } from 'apollo-server-errors';
import {
  startCampaignSource,
  stopCampaignSource,
  validateSquadBoostPermissions,
} from '../common/campaign/source';
import { coresToUsd } from '../common/number';
import { skadiApiClientV2 } from '../integrations/skadi/api/v2/clients';

interface GQLCampaign extends Pick<
  Campaign,
  'id' | 'type' | 'flags' | 'createdAt' | 'endedAt' | 'referenceId' | 'state'
> {
  post: GQLPost;
  source: GQLSource;
}

export const typeDefs = /* GraphQL */ `
  ${toGQLEnum(CampaignType, 'CampaignType')}

  type CampaignFlags {
    budget: Int
    spend: Int
    users: Int
    clicks: Int
    impressions: Int
    newMembers: Int
  }

  type Campaign {
    id: String!
    referenceId: String!
    type: String!
    state: String
    createdAt: DateTime
    endedAt: DateTime!
    flags: CampaignFlags
    user: User
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

  type BoostEstimate {
    min: Int!
    max: Int!
  }

  type UserCampaignStats {
    impressions: Int
    clicks: Int
    users: Int
    spend: Int
    newMembers: Int
  }

  extend type Query {
    campaignById(
      """
      ID of the campaign to fetch
      """
      id: ID!
    ): Campaign!

    campaignsList(
      """
      Paginate after opaque cursor
      """
      after: String
      """
      Paginate first
      """
      first: Int

      """
      ID of the entity to fetch campaigns for
      """
      entityId: ID
    ): CampaignConnection! @auth

    """
    Get aggregated campaign statistics for the authenticated user
    """
    userCampaignStats: UserCampaignStats! @auth

    dailyCampaignReachEstimate(
      """
      Type of campaign (post or source)
      """
      type: CampaignType!
      """
      ID of the post or source to promote
      """
      value: ID!
      """
      Budget for the campaign in cores (1000-100000, must be divisible by 1000)
      """
      budget: Int!
    ): BoostEstimate @auth
  }

  extend type Mutation {
    """
    Start a campaign for a post or source
    """
    startCampaign(
      """
      Type of campaign (post or source)
      """
      type: CampaignType!
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

type StartCampaignMutationArgs = Omit<
  StartCampaignArgs & { type: CampaignType },
  'userId'
>;

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    userCampaignStats: async (
      _,
      __,
      ctx: AuthContext,
    ): Promise<UserCampaignStats> => getUserCampaignStats(ctx),
    campaignById: async (
      _,
      { id }: { id: string },
      ctx: Context,
      info,
    ): Promise<GQLCampaign> =>
      graphorm.queryOneOrFail(ctx, info, (builder) => {
        builder.queryBuilder.where({ id });

        return builder;
      }),
    campaignsList: async (
      _,
      args: ConnectionArguments & {
        entityId?: string;
      },
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

          if (args.entityId) {
            builder.queryBuilder.andWhere(
              `"${alias}"."referenceId" = :entityId`,
              {
                entityId: args.entityId,
              },
            );
          }

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
    dailyCampaignReachEstimate: async (
      _,
      args: StartCampaignMutationArgs,
      ctx: AuthContext,
    ): Promise<{ min: number; max: number }> => {
      const { value, budget, type } = args;

      validateCampaignArgs({ budget, duration: 1 });

      switch (type) {
        case CampaignType.Post:
          await validatePostBoostPermissions(ctx, value);
          break;
        case CampaignType.Squad:
          await validateSquadBoostPermissions(ctx, value);
          break;
        default:
          throw new ValidationError('Unknown campaign type to estimate reach');
      }

      const tags = await getReferenceTags(ctx.con, type, value);
      const { minImpressions, maxImpressions } =
        await skadiApiClientV2.estimateBoostReachDaily({
          type,
          value,
          keywords: tags,
          budget: coresToUsd(budget),
        });

      if (minImpressions === maxImpressions) {
        return getAdjustedReach(maxImpressions);
      }

      const min = Math.max(minImpressions, 0);
      const max = Math.max(maxImpressions, min);

      return { min, max };
    },
  },
  Mutation: {
    startCampaign: async (
      _,
      args: StartCampaignMutationArgs,
      ctx: AuthContext,
    ): Promise<TransactionCreated> => {
      const { type, budget, duration } = args;

      validateCampaignArgs({ budget, duration });

      switch (type) {
        case CampaignType.Post:
          return startCampaignPost({ ctx, args });
        case CampaignType.Squad:
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

      if (campaign.state !== CampaignState.Active) {
        throw new ValidationError('Campaign is not active');
      }

      switch (campaign.type) {
        case CampaignType.Post:
          return stopCampaignPost({ ctx, campaign });
        case CampaignType.Squad:
          return stopCampaignSource({ ctx, campaign });
        default:
          throw new ValidationError('Unknown type to process');
      }
    },
  },
});
