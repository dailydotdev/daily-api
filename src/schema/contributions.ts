import { IResolvers } from '@graphql-tools/utils';
import { ValidationError } from 'apollo-server-errors';
import type { GraphQLResolveInfo } from 'graphql';
import type { Connection, ConnectionArguments } from 'graphql-relay';
import { In } from 'typeorm';
import type z from 'zod';
import { AuthContext, BaseContext, Context } from '../Context';
import {
  getApprovedContributorsCount,
  getApprovedPointsSum,
  getContributionConfig,
  getContributionEligibility,
  getLifetimeAmountCents,
  parseContributionArgs,
  validateContributionActionLimits,
  validateContributionEvidence,
} from '../common/contribution';
import { fulfillContributionReward } from '../common/contribution/rewards';
import {
  claimContributionRewardArgsSchema,
  contributionActionsArgsSchema,
  contributionConnectionArgsSchema,
  contributionSubmissionsArgsSchema,
  submitContributionActionInputSchema,
  updateContributionCausePreferencesArgsSchema,
} from '../common/schema/contributions';
import { ContributionAction } from '../entity/contribution/ContributionAction';
import { ContributionActionCategory } from '../entity/contribution/ContributionActionCategory';
import { ContributionCause } from '../entity/contribution/ContributionCause';
import {
  ContributionPayment,
  ContributionPaymentStatus,
} from '../entity/contribution/ContributionPayment';
import {
  ContributionRewardTier,
  ContributionRewardType,
} from '../entity/contribution/ContributionRewardTier';
import {
  ContributionSubmission,
  ContributionSubmissionStatus,
} from '../entity/contribution/ContributionSubmission';
import { ContributionSponsor } from '../entity/contribution/ContributionSponsor';
import { UserContributionCausePreference } from '../entity/contribution/UserContributionCausePreference';
import {
  UserContributionReward,
  UserContributionRewardStatus,
} from '../entity/contribution/UserContributionReward';
import { NotFoundError } from '../errors';
import graphorm from '../graphorm';
import type { GraphORMBuilder } from '../graphorm/graphorm';
import {
  offsetPageGenerator,
  type GQLEmptyResponse,
  type OffsetPage,
} from './common';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const queryContributionConnection = <
  TNode,
  TArgs extends ConnectionArguments = ConnectionArguments,
>({
  args,
  ctx,
  info,
  beforeQuery,
}: {
  args: TArgs;
  ctx: Context;
  info: GraphQLResolveInfo;
  beforeQuery: (builder: GraphORMBuilder, page: OffsetPage) => GraphORMBuilder;
}): Promise<Connection<TNode>> => {
  const pageGenerator = offsetPageGenerator<TNode>(
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );
  const page = pageGenerator.connArgsToPage(args);

  return graphorm.queryPaginated<TNode>(
    ctx,
    info,
    (nodeSize) => pageGenerator.hasPreviousPage(page, nodeSize),
    (nodeSize) => nodeSize > page.limit,
    (node, index) => pageGenerator.nodeToCursor(page, args, node, index),
    (builder) => beforeQuery(builder, { ...page, limit: page.limit + 1 }),
    (nodes) => nodes.slice(0, page.limit),
    true,
  );
};

type GQLContributionStatus = {
  enabled: boolean;
  // User-specific fields are null for anonymous visitors; the campaign-wide
  // numbers stay populated so the public hero can render live progress.
  eligible: boolean | null;
  currentCyclePoints: number;
  currentCycleTargetPoints: number;
  lifetimePoints: number;
  lifetimeAmountCents: number;
  // Distinct developers who have contributed at least one approved action.
  contributorsCount: number;
  userPoints: number | null;
};

type GQLUserContributionReward = Pick<
  UserContributionReward,
  'status' | 'claimedAt' | 'fulfilledAt'
> & {
  tier: ContributionRewardTier;
};

type GQLUserContributionCauseStats = {
  cause: ContributionCause;
  points: number;
  amountCents: number;
};

const toGQLReward = ({
  reward,
  tier,
}: {
  reward: UserContributionReward;
  tier: ContributionRewardTier;
}): GQLUserContributionReward => ({
  status: reward.status,
  claimedAt: reward.claimedAt,
  fulfilledAt: reward.fulfilledAt,
  tier,
});

export const typeDefs = /* GraphQL */ `
  enum ContributionSubmissionStatus {
    approved
    flagged
    rejected
  }

  enum ContributionRewardType {
    cores
    plus_days
    call
    privilege
    custom
  }

  enum UserContributionRewardStatus {
    claimed
    fulfilled
  }

  enum ContributionSponsorTier {
    gold
    silver
    bronze
  }

  type ContributionStatus {
    enabled: Boolean!
    """
    User-specific eligibility. Null for anonymous visitors.
    """
    eligible: Boolean
    currentCyclePoints: Int!
    currentCycleTargetPoints: Int!
    lifetimePoints: Int!
    lifetimeAmountCents: Int!
    """
    Distinct developers who have contributed at least one approved action.
    """
    contributorsCount: Int!
    """
    The visitor's own approved points. Null for anonymous visitors.
    """
    userPoints: Int
  }

  type ContributionActionMetadata {
    platform: String
    instructions: String
    externalUrl: String
    isLoveAction: Boolean!
  }

  type ContributionActionCategory {
    id: ID!
    title: String!
  }

  type ContributionActionCategoryEdge {
    node: ContributionActionCategory!
    cursor: String!
  }

  type ContributionActionCategoryConnection {
    pageInfo: PageInfo!
    edges: [ContributionActionCategoryEdge!]!
  }

  type ContributionAction {
    id: ID!
    categoryId: ID
    title: String!
    description: String
    points: Int!
    evidence: JSON!
    metadata: ContributionActionMetadata!
    cooldownSeconds: Int
    maxPerUser: Int
    userCooldownEndsAt: DateTime
    userCompletions: Int!
    latestUserSubmission: ContributionSubmission
  }

  type ContributionActionEdge {
    node: ContributionAction!
    cursor: String!
  }

  type ContributionActionConnection {
    pageInfo: PageInfo!
    edges: [ContributionActionEdge!]!
  }

  type ContributionCause {
    id: ID!
    title: String!
    url: String
    description: String
    category: String
    logoUrl: String
    totalPoints: Int!
    totalAmountCents: Int!
  }

  type ContributionCauseEdge {
    node: ContributionCause!
    cursor: String!
  }

  type ContributionCauseConnection {
    pageInfo: PageInfo!
    edges: [ContributionCauseEdge!]!
  }

  type ContributionRewardTier {
    id: ID!
    title: String!
    description: String
    thresholdPoints: Int!
    rewardType: ContributionRewardType!
    metadata: JSON!
  }

  type ContributionRewardTierEdge {
    node: ContributionRewardTier!
    cursor: String!
  }

  type ContributionRewardTierConnection {
    pageInfo: PageInfo!
    edges: [ContributionRewardTierEdge!]!
  }

  type UserContributionReward {
    tier: ContributionRewardTier!
    status: UserContributionRewardStatus!
    claimedAt: DateTime
    fulfilledAt: DateTime
  }

  type UserContributionRewardEdge {
    node: UserContributionReward!
    cursor: String!
  }

  type UserContributionRewardConnection {
    pageInfo: PageInfo!
    edges: [UserContributionRewardEdge!]!
  }

  type UserContributionCauseStats {
    cause: ContributionCause!
    points: Int!
    amountCents: Int!
  }

  type UserContributionCauseStatsEdge {
    node: UserContributionCauseStats!
    cursor: String!
  }

  type UserContributionCauseStatsConnection {
    pageInfo: PageInfo!
    edges: [UserContributionCauseStatsEdge!]!
  }

  type ContributionSubmission {
    id: ID!
    actionId: ID!
    evidence: JSON!
    status: ContributionSubmissionStatus!
    awardedPoints: Int!
    createdAt: DateTime!
    reviewedAt: DateTime
    action: ContributionAction!
  }

  type ContributionSubmissionEdge {
    node: ContributionSubmission!
    cursor: String!
  }

  type ContributionSubmissionConnection {
    pageInfo: PageInfo!
    edges: [ContributionSubmissionEdge!]!
  }

  type ContributionSponsor {
    id: ID!
    name: String!
    amountCents: Int!
    url: String
    logoUrl: String
    tier: ContributionSponsorTier!
  }

  type ContributionSponsorEdge {
    node: ContributionSponsor!
    cursor: String!
  }

  type ContributionSponsorConnection {
    pageInfo: PageInfo!
    edges: [ContributionSponsorEdge!]!
  }

  input SubmitContributionActionInput {
    actionId: ID!
    evidence: JSON!
  }

  extend type Query {
    contributionStatus: ContributionStatus!
    contributionActionCategories(
      first: Int
      after: String
    ): ContributionActionCategoryConnection! @auth @contributionEligibility
    contributionActions(
      categoryId: ID
      first: Int
      after: String
    ): ContributionActionConnection! @auth @contributionEligibility
    userContributionSubmissions(
      actionId: ID
      first: Int
      after: String
    ): ContributionSubmissionConnection! @auth @contributionEligibility
    contributionCauses(first: Int, after: String): ContributionCauseConnection!
      @auth
      @contributionEligibility
    contributionCausePreferences(
      first: Int
      after: String
    ): ContributionCauseConnection! @auth @contributionEligibility
    contributionRewardTiers(
      first: Int
      after: String
    ): ContributionRewardTierConnection! @auth @contributionEligibility
    userContributionRewards(
      first: Int
      after: String
    ): UserContributionRewardConnection! @auth @contributionEligibility
    userContributionCauseStats(
      first: Int
      after: String
    ): UserContributionCauseStatsConnection! @auth @contributionEligibility
    """
    Public campaign social proof: the sponsor wall renders for everyone,
    including logged-out visitors. No user-specific fields, so no auth gate.
    """
    contributionSponsors(
      first: Int
      after: String
    ): ContributionSponsorConnection!
  }

  extend type Mutation {
    submitContributionAction(
      input: SubmitContributionActionInput!
    ): ContributionSubmission! @auth @contributionEligibility
    updateContributionCausePreferences(causeIds: [ID!]!): EmptyResponse!
      @auth
      @contributionEligibility
    claimContributionReward(tierId: ID!): UserContributionReward!
      @auth
      @contributionEligibility
  }
`;

export const resolvers: IResolvers<unknown, BaseContext> = {
  Query: {
    contributionStatus: async (
      _,
      __,
      ctx: Context,
    ): Promise<GQLContributionStatus> => {
      // Public query: the campaign-wide numbers render for everyone (the hero
      // shows live progress to logged-out visitors), while eligibility and the
      // visitor's own points stay null until they sign in.
      const { userId } = ctx;
      const [
        eligibility,
        currentCyclePoints,
        lifetimePoints,
        userPoints,
        lifetimeAmountCents,
        contributorsCount,
      ] = await Promise.all([
        userId
          ? getContributionEligibility({
              con: ctx.con.manager,
              userId,
              region: ctx.region,
            })
          : null,
        getApprovedPointsSum({
          con: ctx.con.manager,
          unpaidOnly: true,
        }),
        getApprovedPointsSum({
          con: ctx.con.manager,
        }),
        userId
          ? getApprovedPointsSum({
              con: ctx.con.manager,
              userId,
            })
          : null,
        getLifetimeAmountCents({
          con: ctx.con.manager,
        }),
        getApprovedContributorsCount({
          con: ctx.con.manager,
        }),
      ]);

      const settings = eligibility?.settings ?? getContributionConfig();

      return {
        enabled: settings.enabled,
        eligible: eligibility?.eligible ?? null,
        currentCyclePoints,
        currentCycleTargetPoints: settings.currentCycleTargetPoints,
        lifetimePoints,
        lifetimeAmountCents,
        contributorsCount,
        userPoints,
      };
    },
    contributionActionCategories: async (
      _,
      args: ConnectionArguments,
      ctx: AuthContext,
      info: GraphQLResolveInfo,
    ): Promise<Connection<ContributionActionCategory>> => {
      const parsedArgs = parseContributionArgs(
        contributionConnectionArgsSchema,
        args,
      );

      return queryContributionConnection<ContributionActionCategory>({
        args: parsedArgs,
        ctx,
        info,
        beforeQuery: (builder, page) => {
          builder.queryBuilder
            .where(`${builder.alias}.active = true`)
            .orderBy(`${builder.alias}."sortOrder"`, 'ASC')
            .addOrderBy(`${builder.alias}."createdAt"`, 'ASC')
            .limit(page.limit)
            .offset(page.offset);

          return builder;
        },
      });
    },
    contributionActions: async (
      _,
      args: ConnectionArguments & { categoryId?: string | null },
      ctx: AuthContext,
      info: GraphQLResolveInfo,
    ): Promise<Connection<ContributionAction>> => {
      const parsedArgs = parseContributionArgs(
        contributionActionsArgsSchema,
        args,
      );

      return queryContributionConnection<ContributionAction>({
        args: parsedArgs,
        ctx,
        info,
        beforeQuery: (builder, page) => {
          builder.queryBuilder
            .where(`${builder.alias}.active = true`)
            .orderBy(`${builder.alias}."sortOrder"`, 'ASC')
            .addOrderBy(`${builder.alias}."createdAt"`, 'ASC')
            .limit(page.limit)
            .offset(page.offset);

          if (parsedArgs.categoryId) {
            builder.queryBuilder.andWhere(
              `${builder.alias}."categoryId" = :categoryId`,
              { categoryId: parsedArgs.categoryId },
            );
          }

          return builder;
        },
      });
    },
    userContributionSubmissions: async (
      _,
      args: ConnectionArguments & { actionId?: string | null },
      ctx: AuthContext,
      info: GraphQLResolveInfo,
    ): Promise<Connection<ContributionSubmission>> => {
      const parsedArgs = parseContributionArgs(
        contributionSubmissionsArgsSchema,
        args,
      );

      return queryContributionConnection<ContributionSubmission>({
        args: parsedArgs,
        ctx,
        info,
        beforeQuery: (builder, page) => {
          builder.queryBuilder
            .where(`${builder.alias}."userId" = :userId`, {
              userId: ctx.userId,
            })
            .orderBy(`${builder.alias}."createdAt"`, 'DESC')
            .addOrderBy(`${builder.alias}."id"`, 'DESC')
            .limit(page.limit)
            .offset(page.offset);

          if (parsedArgs.actionId) {
            builder.queryBuilder.andWhere(
              `${builder.alias}."actionId" = :actionId`,
              { actionId: parsedArgs.actionId },
            );
          }

          return builder;
        },
      });
    },
    contributionCauses: async (
      _,
      args: ConnectionArguments,
      ctx: AuthContext,
      info: GraphQLResolveInfo,
    ): Promise<Connection<ContributionCause>> => {
      const parsedArgs = parseContributionArgs(
        contributionConnectionArgsSchema,
        args,
      );

      return queryContributionConnection<ContributionCause>({
        args: parsedArgs,
        ctx,
        info,
        beforeQuery: (builder, page) => {
          builder.queryBuilder
            .where(`${builder.alias}.active = true`)
            .orderBy(`${builder.alias}."sortOrder"`, 'ASC')
            .addOrderBy(`${builder.alias}."createdAt"`, 'ASC')
            .limit(page.limit)
            .offset(page.offset);

          return builder;
        },
      });
    },
    contributionCausePreferences: async (
      _,
      args: ConnectionArguments,
      ctx: AuthContext,
      info: GraphQLResolveInfo,
    ): Promise<Connection<ContributionCause>> => {
      const parsedArgs = parseContributionArgs(
        contributionConnectionArgsSchema,
        args,
      );

      return queryContributionConnection<ContributionCause>({
        args: parsedArgs,
        ctx,
        info,
        beforeQuery: (builder, page) => {
          builder.queryBuilder
            .innerJoin(
              UserContributionCausePreference,
              'preference',
              `preference."causeId" = "${builder.alias}"."id" AND preference."userId" = :userId`,
              { userId: ctx.userId },
            )
            .where(`${builder.alias}.active = true`)
            .orderBy(`${builder.alias}."sortOrder"`, 'ASC')
            .addOrderBy(`${builder.alias}."createdAt"`, 'ASC')
            .limit(page.limit)
            .offset(page.offset);

          return builder;
        },
      });
    },
    contributionRewardTiers: async (
      _,
      args: ConnectionArguments,
      ctx: AuthContext,
      info: GraphQLResolveInfo,
    ): Promise<Connection<ContributionRewardTier>> => {
      const parsedArgs = parseContributionArgs(
        contributionConnectionArgsSchema,
        args,
      );

      return queryContributionConnection<ContributionRewardTier>({
        args: parsedArgs,
        ctx,
        info,
        beforeQuery: (builder, page) => {
          builder.queryBuilder
            .where(`${builder.alias}.active = true`)
            .orderBy(`${builder.alias}."thresholdPoints"`, 'ASC')
            .addOrderBy(`${builder.alias}."sortOrder"`, 'ASC')
            .addOrderBy(`${builder.alias}."createdAt"`, 'ASC')
            .limit(page.limit)
            .offset(page.offset);

          return builder;
        },
      });
    },
    userContributionRewards: async (
      _,
      args: ConnectionArguments,
      ctx: AuthContext,
      info: GraphQLResolveInfo,
    ): Promise<Connection<UserContributionReward>> => {
      const parsedArgs = parseContributionArgs(
        contributionConnectionArgsSchema,
        args,
      );

      return queryContributionConnection<UserContributionReward>({
        args: parsedArgs,
        ctx,
        info,
        beforeQuery: (builder, page) => {
          builder.queryBuilder
            .where(`${builder.alias}."userId" = :userId`, {
              userId: ctx.userId,
            })
            .orderBy(`${builder.alias}."claimedAt"`, 'DESC')
            .addOrderBy(`${builder.alias}."createdAt"`, 'DESC')
            .limit(page.limit)
            .offset(page.offset);

          return builder;
        },
      });
    },
    userContributionCauseStats: async (
      _,
      args: ConnectionArguments,
      ctx: AuthContext,
      info: GraphQLResolveInfo,
    ): Promise<Connection<GQLUserContributionCauseStats>> => {
      const parsedArgs = parseContributionArgs(
        contributionConnectionArgsSchema,
        args,
      );

      return queryContributionConnection<GQLUserContributionCauseStats>({
        args: parsedArgs,
        ctx,
        info,
        beforeQuery: (builder, page) => {
          builder.queryBuilder
            .innerJoin(
              ContributionPayment,
              'payment',
              `payment.id = "${builder.alias}"."paymentId" AND payment.status = :status`,
              { status: ContributionPaymentStatus.Finalized },
            )
            .where(`${builder.alias}."userId" = :userId`, {
              userId: ctx.userId,
            })
            .groupBy(`${builder.alias}."causeId"`)
            .orderBy(`SUM("${builder.alias}"."points")`, 'DESC')
            .limit(page.limit)
            .offset(page.offset);

          return builder;
        },
      });
    },
    contributionSponsors: async (
      _,
      args: ConnectionArguments,
      ctx: Context,
      info: GraphQLResolveInfo,
    ): Promise<Connection<ContributionSponsor>> => {
      const parsedArgs = parseContributionArgs(
        contributionConnectionArgsSchema,
        args,
      );

      return queryContributionConnection<ContributionSponsor>({
        args: parsedArgs,
        ctx,
        info,
        beforeQuery: (builder, page) => {
          builder.queryBuilder
            .where(`${builder.alias}.active = true`)
            .orderBy(`${builder.alias}."sortOrder"`, 'ASC')
            .addOrderBy(`${builder.alias}."createdAt"`, 'ASC')
            .limit(page.limit)
            .offset(page.offset);

          return builder;
        },
      });
    },
  },
  Mutation: {
    submitContributionAction: async (
      _,
      { input }: { input: z.infer<typeof submitContributionActionInputSchema> },
      ctx: AuthContext,
    ): Promise<ContributionSubmission> => {
      const parsedInput = parseContributionArgs(
        submitContributionActionInputSchema,
        input,
      );
      const now = new Date();

      return ctx.con.transaction(async (con) => {
        const action = await con.getRepository(ContributionAction).findOne({
          where: {
            id: parsedInput.actionId,
            active: true,
          },
        });

        if (!action) {
          throw new NotFoundError('Contribution action not found');
        }

        if (action.points <= 0 || action.metadata?.isLoveAction) {
          throw new ValidationError('Contribution action is not rewardable');
        }

        validateContributionEvidence({
          input: parsedInput.evidence,
          action,
        });
        await validateContributionActionLimits({
          con,
          userId: ctx.userId,
          action,
          now,
        });

        return con.getRepository(ContributionSubmission).save({
          userId: ctx.userId,
          actionId: action.id,
          evidence: parsedInput.evidence,
          status: ContributionSubmissionStatus.Approved,
          awardedPoints: action.points,
          flags: {},
        });
      });
    },
    updateContributionCausePreferences: async (
      _,
      args: z.infer<typeof updateContributionCausePreferencesArgsSchema>,
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const { causeIds } = parseContributionArgs(
        updateContributionCausePreferencesArgsSchema,
        args,
      );
      const uniqueCauseIds = [...new Set(causeIds)];

      await ctx.con.transaction(async (con) => {
        if (uniqueCauseIds.length) {
          const activeCauses = await con.getRepository(ContributionCause).find({
            where: {
              id: In(uniqueCauseIds),
              active: true,
            },
          });

          if (activeCauses.length !== uniqueCauseIds.length) {
            throw new ValidationError('Invalid cause selection');
          }
        }

        await con.getRepository(UserContributionCausePreference).delete({
          userId: ctx.userId,
        });

        if (uniqueCauseIds.length) {
          await con.getRepository(UserContributionCausePreference).insert(
            uniqueCauseIds.map((causeId) => ({
              userId: ctx.userId,
              causeId,
            })),
          );
        }
      });

      return { _: true };
    },
    claimContributionReward: async (
      _,
      args: z.infer<typeof claimContributionRewardArgsSchema>,
      ctx: AuthContext,
    ): Promise<GQLUserContributionReward> => {
      const { tierId } = parseContributionArgs(
        claimContributionRewardArgsSchema,
        args,
      );

      return ctx.con.transaction(async (con) => {
        const tier = await con.getRepository(ContributionRewardTier).findOne({
          where: {
            id: tierId,
            active: true,
          },
        });

        if (!tier) {
          throw new NotFoundError('Contribution reward tier not found');
        }

        const userPoints = await getApprovedPointsSum({
          con,
          userId: ctx.userId,
        });

        if (userPoints < tier.thresholdPoints) {
          throw new ValidationError('Reward threshold has not been reached');
        }

        const existing = await con
          .getRepository(UserContributionReward)
          .findOne({
            where: {
              userId: ctx.userId,
              tierId: tier.id,
            },
          });

        if (existing) {
          const reward = await fulfillContributionReward({
            con,
            ctx,
            tier,
            reward: existing,
          });

          return toGQLReward({ reward, tier });
        }

        const reward = await fulfillContributionReward({
          con,
          ctx,
          tier,
          reward: await con.getRepository(UserContributionReward).save({
            userId: ctx.userId,
            tierId: tier.id,
            status: UserContributionRewardStatus.Claimed,
            claimedAt: new Date(),
            fulfilledAt: null,
          }),
        });

        return toGQLReward({ reward, tier });
      });
    },
  },
  ContributionRewardTier: {
    rewardType: (tier: ContributionRewardTier): ContributionRewardType =>
      tier.rewardType,
  },
};
