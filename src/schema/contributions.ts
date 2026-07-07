import { IResolvers } from '@graphql-tools/utils';
import { ValidationError } from 'apollo-server-errors';
import type { GraphQLResolveInfo } from 'graphql';
import type { Connection, ConnectionArguments } from 'graphql-relay';
import { In, LessThanOrEqual } from 'typeorm';
import type z from 'zod';
import { AuthContext, BaseContext, Context } from '../Context';
import {
  CONTRIBUTION_ACTION_COMPLETED_CHANNEL,
  getApprovedContributorsCount,
  getApprovedPointsSum,
  getContributionConfig,
  getContributionCauseBreakdown,
  getContributionEligibility,
  getContributionUserRank,
  getLastReachedMilestone,
  getLifetimeAmountCents,
  parseContributionArgs,
  validateContributionActionLimits,
  validateContributionEvidence,
} from '../common/contribution';
import { fulfillContributionReward } from '../common/contribution/rewards';
import { notifyContributionRewardClaimedSlack } from '../common/slack';
import { logger } from '../logger';
import { User } from '../entity/user/User';
import {
  claimContributionRewardArgsSchema,
  contributionActionLinksArgsSchema,
  contributionActionsArgsSchema,
  contributionConnectionArgsSchema,
  contributionSubmissionsArgsSchema,
  submitContributionActionInputSchema,
  updateContributionCausePreferencesArgsSchema,
} from '../common/schema/contributions';
import { ContributionAction } from '../entity/contribution/ContributionAction';
import { ContributionActionCategory } from '../entity/contribution/ContributionActionCategory';
import { ContributionActionLink } from '../entity/contribution/ContributionActionLink';
import { ContributionCause } from '../entity/contribution/ContributionCause';
import { ContributionFoundingContributor } from '../entity/contribution/ContributionFoundingContributor';
import { CONTRIBUTION_FOUNDING_LIMIT } from '../common/contribution/founding';
import { ContributionMilestone } from '../entity/contribution/ContributionMilestone';
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
import { redisPubSub } from '../redis';
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

type GQLContributionFoundingAward = {
  totalSpots: number;
  claimedCount: number;
  isFoundingMember: boolean;
  memberNumber: number | null;
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

type GQLContributionLeaderboardEntry = {
  points: number;
  rank: number;
};

type GQLContributionActionCompleted = {
  submissionId: string;
  userId: string;
  actionId: string;
  awardedPoints: number;
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
    store_discount
    suggest_causes
    council
    patchy_picture
    joke
    trivia
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

  """
  The founding-contributor award: a one-time, capped gift for the first N
  contributors, granted automatically on a contributor's first approved action.
  Campaign-wide fields render for everyone; the visitor's own membership is null
  until they sign in (and stays false/null until they become a founder).
  """
  type ContributionFoundingAward {
    totalSpots: Int!
    claimedCount: Int!
    """
    Whether the visitor is a founding contributor. False for anonymous visitors.
    """
    isFoundingMember: Boolean!
    """
    The visitor's founding number (1-based, by grant order). Null unless they are
    a founding contributor.
    """
    memberNumber: Int
  }

  type ContributionActionMetadata {
    platform: String
    instructions: String
    externalUrl: String
    isLoveAction: Boolean!
    assistType: String
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

  type ContributionActionLink {
    id: ID!
    url: String!
    label: String
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

  type ContributionMilestone {
    id: ID!
    value: Int!
    title: String
    reachedAt: DateTime
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

  type ContributionLeaderboardEntry {
    user: User!
    points: Int!
    rank: Int!
  }

  type ContributionLeaderboardEntryEdge {
    node: ContributionLeaderboardEntry!
    cursor: String!
  }

  type ContributionLeaderboardConnection {
    pageInfo: PageInfo!
    edges: [ContributionLeaderboardEntryEdge!]!
  }

  type ContributionUserRank {
    points: Int!
    rank: Int!
  }

  """
  Projected share of the current cycle's points for one cause category.
  """
  type ContributionCauseCategoryBreakdown {
    category: String
    points: Int!
  }

  input SubmitContributionActionInput {
    actionId: ID!
    evidence: JSON!
  }

  extend type Query {
    contributionStatus: ContributionStatus!
    contributionFoundingAward: ContributionFoundingAward!
    contributionActionCategories(
      first: Int
      after: String
    ): ContributionActionCategoryConnection! @auth @contributionEligibility
    contributionActions(
      categoryId: ID
      first: Int
      after: String
    ): ContributionActionConnection! @auth @contributionEligibility
    """
    A randomized handful of pool links for a link_pool action (e.g. community
    questions to answer). The pool can hold hundreds; we surface a few at a time.
    """
    contributionActionLinks(
      actionId: ID!
      limit: Int
    ): [ContributionActionLink!]! @auth @contributionEligibility
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
    """
    The highest global milestone reached, served from cache for the header
    gift-icon poll. Null until the first milestone is crossed.
    """
    contributionLastReachedMilestone: ContributionMilestone
    """
    Current-cycle leaderboard ranked by unpaid approved points.
    """
    contributionLeaderboard(
      first: Int
      after: String
    ): ContributionLeaderboardConnection!
    """
    The viewer's own current-cycle points and rank. Null when they have no
    current-cycle points.
    """
    contributionUserRank: ContributionUserRank @auth
    """
    Projected current-cycle points split across cause categories.
    """
    contributionCauseBreakdown: [ContributionCauseCategoryBreakdown!]!
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

  type ContributionActionCompleted {
    submissionId: ID!
    userId: ID!
    actionId: ID!
    awardedPoints: Int!
  }

  extend type Subscription {
    contributionActionCompleted: ContributionActionCompleted! @auth
  }
`;

const DEFAULT_POOL_LINK_LIMIT = 5;

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
    contributionFoundingAward: async (
      _,
      __,
      ctx: Context,
    ): Promise<GQLContributionFoundingAward> => {
      // Public query: the spots-taken counter renders for everyone; the visitor's
      // own founding membership stays false/null until they sign in and qualify.
      const repo = ctx.con.getRepository(ContributionFoundingContributor);
      const { userId } = ctx;
      const [claimedCount, membership] = await Promise.all([
        repo.count(),
        userId
          ? repo.findOne({ select: ['userId', 'createdAt'], where: { userId } })
          : null,
      ]);

      // 1-based grant order (how many founders joined at or before this one).
      const memberNumber = membership
        ? await repo.countBy({
            createdAt: LessThanOrEqual(membership.createdAt),
          })
        : null;

      return {
        totalSpots: CONTRIBUTION_FOUNDING_LIMIT,
        claimedCount,
        isFoundingMember: !!membership,
        memberNumber,
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
    contributionActionLinks: async (
      _,
      args: { actionId: string; limit?: number | null },
      ctx: AuthContext,
      info: GraphQLResolveInfo,
    ): Promise<ContributionActionLink[]> => {
      const { actionId, limit } = parseContributionArgs(
        contributionActionLinksArgsSchema,
        args,
      );

      return graphorm.query<ContributionActionLink>(ctx, info, (builder) => {
        builder.queryBuilder
          .where(`"${builder.alias}"."actionId" = :actionId`, { actionId })
          .andWhere(`"${builder.alias}"."active" = true`)
          .orderBy('RANDOM()')
          .limit(limit ?? DEFAULT_POOL_LINK_LIMIT);

        return builder;
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
    contributionLastReachedMilestone: (
      _,
      __,
      ctx: Context,
    ): Promise<Pick<
      ContributionMilestone,
      'id' | 'value' | 'title' | 'reachedAt'
    > | null> => getLastReachedMilestone({ con: ctx.con.manager }),
    contributionLeaderboard: async (
      _,
      args: ConnectionArguments,
      ctx: Context,
      info: GraphQLResolveInfo,
    ): Promise<Connection<GQLContributionLeaderboardEntry>> => {
      const parsedArgs = parseContributionArgs(
        contributionConnectionArgsSchema,
        args,
      );

      return queryContributionConnection<GQLContributionLeaderboardEntry>({
        args: parsedArgs,
        ctx,
        info,
        beforeQuery: (builder, page) => {
          builder.queryBuilder
            .where(`${builder.alias}.status = :status`, {
              status: ContributionSubmissionStatus.Approved,
            })
            .andWhere(`${builder.alias}."paymentId" IS NULL`)
            .groupBy(`${builder.alias}."userId"`)
            .orderBy(
              `COALESCE(SUM(${builder.alias}."awardedPoints"), 0)`,
              'DESC',
            )
            .addOrderBy(`MIN(${builder.alias}."createdAt")`, 'ASC')
            .addOrderBy(`${builder.alias}."userId"`, 'ASC')
            .limit(page.limit)
            .offset(page.offset);

          return builder;
        },
      });
    },
    contributionUserRank: (
      _,
      __,
      ctx: AuthContext,
    ): Promise<{ points: number; rank: number } | null> =>
      getContributionUserRank({ con: ctx.con, userId: ctx.userId }),
    contributionCauseBreakdown: (
      _,
      __,
      ctx: Context,
    ): Promise<{ category: string | null; points: number }[]> =>
      getContributionCauseBreakdown({ con: ctx.con }),
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

      const { tier, reward, newlyFulfilled } = await ctx.con.transaction(
        async (con) => {
          const rewardTier = await con
            .getRepository(ContributionRewardTier)
            .findOne({
              where: {
                id: tierId,
                active: true,
              },
            });

          if (!rewardTier) {
            throw new NotFoundError('Contribution reward tier not found');
          }

          const userPoints = await getApprovedPointsSum({
            con,
            userId: ctx.userId,
          });

          if (userPoints < rewardTier.thresholdPoints) {
            throw new ValidationError('Reward threshold has not been reached');
          }

          const existing = await con
            .getRepository(UserContributionReward)
            .findOne({
              where: {
                userId: ctx.userId,
                tierId: rewardTier.id,
              },
            });
          const wasFulfilled =
            existing?.status === UserContributionRewardStatus.Fulfilled;

          const claimedReward = await fulfillContributionReward({
            con,
            ctx,
            tier: rewardTier,
            reward:
              existing ??
              (await con.getRepository(UserContributionReward).save({
                userId: ctx.userId,
                tierId: rewardTier.id,
                status: UserContributionRewardStatus.Claimed,
                claimedAt: new Date(),
                fulfilledAt: null,
              })),
          });

          return {
            tier: rewardTier,
            reward: claimedReward,
            newlyFulfilled:
              !wasFulfilled &&
              claimedReward.status === UserContributionRewardStatus.Fulfilled,
          };
        },
      );

      // Coupon / council rewards are fulfilled by a human — ping the team once,
      // after the claim has committed, so a failed claim never notifies and a
      // Slack outage never fails the claim.
      const slackNotifyTypes = [
        ContributionRewardType.StoreDiscount,
        ContributionRewardType.Council,
      ];
      if (newlyFulfilled && slackNotifyTypes.includes(tier.rewardType)) {
        try {
          const user = await ctx.con.getRepository(User).findOne({
            select: ['id', 'username', 'name', 'email'],
            where: { id: ctx.userId },
          });

          if (user) {
            await notifyContributionRewardClaimedSlack({ user, tier });
          }
        } catch (err) {
          logger.error(
            { err, tierId: tier.id, userId: ctx.userId },
            'failed to notify Slack of contribution reward claim',
          );
        }
      }

      return toGQLReward({ reward, tier });
    },
  },
  Subscription: {
    contributionActionCompleted: {
      subscribe: async (): Promise<
        AsyncIterable<{
          contributionActionCompleted: GQLContributionActionCompleted;
        }>
      > => {
        const iterator =
          redisPubSub.asyncIterator<GQLContributionActionCompleted>(
            CONTRIBUTION_ACTION_COMPLETED_CHANNEL,
          );

        return {
          [Symbol.asyncIterator]() {
            return {
              next: async () => {
                const { done, value } = await iterator.next();
                if (done) {
                  return { done: true, value: undefined };
                }
                return {
                  done: false,
                  value: { contributionActionCompleted: value },
                };
              },
              return: async () => {
                await iterator.return?.();
                return { done: true, value: undefined };
              },
              throw: async (error: Error) => {
                await iterator.throw?.(error);
                return { done: true, value: undefined };
              },
            };
          },
        };
      },
    },
  },
  ContributionRewardTier: {
    rewardType: (tier: ContributionRewardTier): ContributionRewardType =>
      tier.rewardType,
  },
};
