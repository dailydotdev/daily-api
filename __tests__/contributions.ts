import { createClient } from '@connectrpc/connect';
import { Credits } from '@dailydotdev/schema';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import appFunc from '../src';
import type { Context } from '../src/Context';
import {
  disposeGraphQLTesting,
  initializeGraphQLTesting,
  MockContext,
  createMockNjordTransport,
  saveFixtures,
  type GraphQLTestClient,
  type GraphQLTestingState,
} from './helpers';
import { User } from '../src/entity/user/User';
import * as njordCommon from '../src/common/njord';
import { SubscriptionCycles } from '../src/paddle';
import { ContributionAction } from '../src/entity/contribution/ContributionAction';
import { ContributionActionLink } from '../src/entity/contribution/ContributionActionLink';
import { ContributionActionCategory } from '../src/entity/contribution/ContributionActionCategory';
import { ContributionBlockedUser } from '../src/entity/contribution/ContributionBlockedUser';
import { ContributionCause } from '../src/entity/contribution/ContributionCause';
import {
  ContributionPayment,
  ContributionPaymentStatus,
} from '../src/entity/contribution/ContributionPayment';
import { ContributionPaymentAllocation } from '../src/entity/contribution/ContributionPaymentAllocation';
import { ContributionRewardTier } from '../src/entity/contribution/ContributionRewardTier';
import {
  ContributionSubmission,
  ContributionSubmissionStatus,
} from '../src/entity/contribution/ContributionSubmission';
import { ContributionRewardType } from '../src/entity/contribution/ContributionRewardTier';
import { ContributionSponsor } from '../src/entity/contribution/ContributionSponsor';
import { UserContributionCausePreference } from '../src/entity/contribution/UserContributionCausePreference';
import { UserContributionReward } from '../src/entity/contribution/UserContributionReward';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
  UserTransactionType,
} from '../src/entity/user/UserTransaction';
import { remoteConfig } from '../src/remoteConfig';

let con: DataSource;
let client: GraphQLTestClient;
let state: GraphQLTestingState | undefined;
let loggedUser: string | null = null;
let region = 'US';

const userId = '99999999-9999-4999-8999-999999999998';
const blockedUserId = '99999999-9999-4999-8999-999999999997';
const categoryId = '11111111-1111-4111-8111-111111111111';
const secondCategoryId = '11111111-1111-4111-8111-111111111112';
const actionId = '22222222-2222-4222-8222-222222222222';
const secondActionId = '22222222-2222-4222-8222-222222222223';
const loveActionId = '22222222-2222-4222-8222-222222222224';
const causeId = '33333333-3333-4333-8333-333333333333';
const secondCauseId = '33333333-3333-4333-8333-333333333334';
const sponsorId = '33333333-3333-4333-8333-333333333335';
const tierId = '44444444-4444-4444-8444-444444444444';
const coresTierId = '44444444-4444-4444-8444-444444444445';
const paymentId = '55555555-5555-4555-8555-555555555555';

const CONTRIBUTION_STATUS_QUERY = `
query ContributionStatus {
  contributionStatus {
    enabled
    eligible
    currentCyclePoints
    currentCycleTargetPoints
    lifetimePoints
    lifetimeAmountCents
    contributorsCount
    userPoints
  }
}
`;

const CONTRIBUTION_ACTIONS_QUERY = `
query ContributionActions($categoryId: ID) {
  contributionActions(categoryId: $categoryId, first: 10) {
    edges {
      node {
        id
        categoryId
        title
        points
        evidence
        metadata {
          platform
          instructions
          externalUrl
          isLoveAction
        }
        maxPerUser
        userCompletions
        latestUserSubmission {
          status
          awardedPoints
          evidence
        }
      }
    }
  }
}
`;

const CONTRIBUTION_ACTION_LINKS_QUERY = `
query ContributionActionLinks($actionId: ID!, $limit: Int) {
  contributionActionLinks(actionId: $actionId, limit: $limit) {
    id
    url
    label
  }
}
`;

const USER_CONTRIBUTION_SUBMISSIONS_QUERY = `
query UserContributionSubmissions($actionId: ID) {
  userContributionSubmissions(actionId: $actionId, first: 10) {
    edges {
      node {
        actionId
        status
        awardedPoints
        evidence
        reviewedAt
        action {
          id
          title
        }
      }
    }
  }
}
`;

const CONTRIBUTION_CAUSES_QUERY = `
query ContributionCauses {
  contributionCauses(first: 10) {
    edges {
      node {
        id
        title
        description
        category
        logoUrl
        totalPoints
        totalAmountCents
      }
    }
  }
}
`;

const CONTRIBUTION_SPONSORS_QUERY = `
query ContributionSponsors {
  contributionSponsors(first: 10) {
    edges {
      node {
        id
        name
        amountCents
        url
        logoUrl
        tier
      }
    }
  }
}
`;

const CONTRIBUTION_PREFERENCES_QUERY = `
query ContributionCausePreferences {
  contributionCausePreferences(first: 10) {
    edges {
      node {
        id
        title
      }
    }
  }
}
`;

const USER_CAUSE_STATS_QUERY = `
query UserContributionCauseStats {
  userContributionCauseStats(first: 10) {
    edges {
      node {
        points
        amountCents
        cause {
          id
          title
          description
          category
          logoUrl
          totalPoints
          totalAmountCents
        }
      }
    }
  }
}
`;

const SUBMIT_CONTRIBUTION_ACTION_MUTATION = `
mutation SubmitContributionAction($input: SubmitContributionActionInput!) {
  submitContributionAction(input: $input) {
    id
    actionId
    status
    awardedPoints
    evidence
  }
}
`;

const UPDATE_CAUSE_PREFERENCES_MUTATION = `
mutation UpdateContributionCausePreferences($causeIds: [ID!]!) {
  updateContributionCausePreferences(causeIds: $causeIds) {
    _
  }
}
`;

const CLAIM_CONTRIBUTION_REWARD_MUTATION = `
mutation ClaimContributionReward($tierId: ID!) {
  claimContributionReward(tierId: $tierId) {
    status
    claimedAt
    fulfilledAt
    tier {
      id
      title
      thresholdPoints
      rewardType
      metadata
    }
  }
}
`;

beforeAll(async () => {
  con = await createOrGetConnection();
  const app = await appFunc();
  state = await initializeGraphQLTesting(
    () =>
      new MockContext(
        con,
        loggedUser,
        [],
        undefined,
        false,
        false,
        region,
      ) as Context,
  );
  client = state.client;
  return app.ready();
});

beforeEach(async () => {
  jest.restoreAllMocks();
  loggedUser = userId;
  region = 'US';

  await con.getRepository(UserTransaction).delete({
    referenceType: UserTransactionType.ContributionReward,
  });
  await con
    .createQueryBuilder()
    .delete()
    .from(UserContributionReward)
    .execute();
  await con
    .createQueryBuilder()
    .delete()
    .from(UserContributionCausePreference)
    .execute();
  await con
    .createQueryBuilder()
    .delete()
    .from(ContributionSubmission)
    .execute();
  await con
    .createQueryBuilder()
    .delete()
    .from(ContributionPaymentAllocation)
    .execute();
  await con
    .createQueryBuilder()
    .delete()
    .from(ContributionBlockedUser)
    .execute();
  await con.createQueryBuilder().delete().from(ContributionAction).execute();
  await con
    .createQueryBuilder()
    .delete()
    .from(ContributionRewardTier)
    .execute();
  await con.createQueryBuilder().delete().from(ContributionPayment).execute();
  await con.createQueryBuilder().delete().from(ContributionCause).execute();
  await con
    .createQueryBuilder()
    .delete()
    .from(ContributionActionCategory)
    .execute();
  await con.getRepository(User).delete({ id: userId });
  await con.getRepository(User).delete({ id: blockedUserId });

  remoteConfig.vars.contributionProgram = {
    enabled: true,
    allowedCountries: ['US'],
    currentCycleTargetPoints: 10000,
  };

  await saveFixtures(con, User, [
    { id: userId, reputation: 10 },
    { id: blockedUserId, reputation: 10 },
  ]);
});

afterAll(async () => {
  await disposeGraphQLTesting(state);
});

const seedActions = async () => {
  await saveFixtures(con, ContributionActionCategory, [
    {
      id: secondCategoryId,
      title: 'Offline',
      sortOrder: 2,
    },
    {
      id: categoryId,
      title: 'Social',
      sortOrder: 1,
    },
  ]);
  await saveFixtures(con, ContributionAction, [
    {
      id: secondActionId,
      categoryId: secondCategoryId,
      title: 'Host meetup',
      points: 500,
      evidence: { screenshot: { required: true } },
      sortOrder: 2,
    },
    {
      id: actionId,
      categoryId,
      title: 'Post on Reddit',
      points: 25,
      evidence: { url: { required: true, allowedDomains: ['Reddit.com'] } },
      metadata: {
        platform: 'reddit',
        instructions: 'Submit the public Reddit URL.',
        externalUrl: 'https://reddit.com/r/programming',
      },
      maxPerUser: 1,
      sortOrder: 1,
    },
  ]);
};

const seedCauses = async () => {
  await saveFixtures(con, ContributionCause, [
    {
      id: secondCauseId,
      title: 'Open Source Grants',
      description: 'Funding maintainers and tools.',
      category: 'Open source',
      logoUrl: 'https://daily.dev/oss.png',
      sortOrder: 2,
    },
    {
      id: causeId,
      title: 'Developer Education',
      description: 'Helping developers learn.',
      category: 'Education',
      logoUrl: 'https://daily.dev/education.png',
      sortOrder: 1,
    },
  ]);
};

it('returns opaque eligibility status and rejects program lists when ineligible', async () => {
  await seedActions();
  region = 'IL';

  const status = await client.query(CONTRIBUTION_STATUS_QUERY);
  const actions = await client.query(CONTRIBUTION_ACTIONS_QUERY);

  expect(status.data.contributionStatus).toEqual({
    enabled: true,
    eligible: false,
    currentCyclePoints: 0,
    currentCycleTargetPoints: 10000,
    lifetimePoints: 0,
    lifetimeAmountCents: 0,
    contributorsCount: 0,
    userPoints: 0,
  });
  expect(actions.errors?.[0].message).toEqual(
    'User is not eligible for this program',
  );
});

it('marks blocked users ineligible without exposing a reason', async () => {
  await saveFixtures(con, ContributionBlockedUser, [
    {
      userId: blockedUserId,
      reason: 'manual review',
    },
  ]);
  loggedUser = blockedUserId;

  const res = await client.query(CONTRIBUTION_STATUS_QUERY);

  expect(res.data.contributionStatus).toMatchObject({
    enabled: true,
    eligible: false,
  });
});

it('exposes campaign-wide status to anonymous visitors with null user fields', async () => {
  loggedUser = null;

  const status = await client.query(CONTRIBUTION_STATUS_QUERY);

  expect(status.errors).toBeUndefined();
  expect(status.data.contributionStatus).toEqual({
    enabled: true,
    eligible: null,
    currentCyclePoints: 0,
    currentCycleTargetPoints: 10000,
    lifetimePoints: 0,
    lifetimeAmountCents: 0,
    contributorsCount: 0,
    userPoints: null,
  });
});

it('returns actions by category and records approved submissions with limits', async () => {
  await seedActions();

  const actions = await client.query(CONTRIBUTION_ACTIONS_QUERY, {
    variables: { categoryId },
  });

  expect(actions.data.contributionActions.edges).toEqual([
    {
      node: {
        id: actionId,
        categoryId,
        title: 'Post on Reddit',
        points: 25,
        evidence: { url: { required: true, allowedDomains: ['Reddit.com'] } },
        metadata: {
          platform: 'reddit',
          instructions: 'Submit the public Reddit URL.',
          externalUrl: 'https://reddit.com/r/programming',
          isLoveAction: false,
        },
        maxPerUser: 1,
        userCompletions: 0,
        latestUserSubmission: null,
      },
    },
  ]);

  const invalidDomain = await client.mutate(
    SUBMIT_CONTRIBUTION_ACTION_MUTATION,
    {
      variables: {
        input: {
          actionId,
          evidence: {
            url: 'https://example.com/r/programming/comments/123',
          },
        },
      },
    },
  );

  expect(invalidDomain.errors?.[0].message).toEqual(
    'URL evidence domain is not allowed',
  );

  const submitted = await client.mutate(SUBMIT_CONTRIBUTION_ACTION_MUTATION, {
    variables: {
      input: {
        actionId,
        evidence: {
          url: 'https://www.reddit.com/r/programming/comments/123',
        },
      },
    },
  });

  expect(submitted.errors).toBeUndefined();
  expect(submitted.data.submitContributionAction).toMatchObject({
    actionId,
    status: ContributionSubmissionStatus.Approved,
    awardedPoints: 25,
    evidence: {
      url: 'https://www.reddit.com/r/programming/comments/123',
    },
  });

  const status = await client.query(CONTRIBUTION_STATUS_QUERY);
  expect(status.data.contributionStatus).toMatchObject({
    currentCyclePoints: 25,
    lifetimePoints: 25,
    contributorsCount: 1,
    userPoints: 25,
  });

  const [submissions, updatedActions] = await Promise.all([
    client.query(USER_CONTRIBUTION_SUBMISSIONS_QUERY, {
      variables: { actionId },
    }),
    client.query(CONTRIBUTION_ACTIONS_QUERY, {
      variables: { categoryId },
    }),
  ]);

  expect(submissions.data.userContributionSubmissions.edges).toEqual([
    {
      node: {
        actionId,
        status: ContributionSubmissionStatus.Approved,
        awardedPoints: 25,
        evidence: {
          url: 'https://www.reddit.com/r/programming/comments/123',
        },
        reviewedAt: null,
        action: {
          id: actionId,
          title: 'Post on Reddit',
        },
      },
    },
  ]);
  expect(
    updatedActions.data.contributionActions.edges[0].node.latestUserSubmission,
  ).toMatchObject({
    status: ContributionSubmissionStatus.Approved,
    awardedPoints: 25,
    evidence: {
      url: 'https://www.reddit.com/r/programming/comments/123',
    },
  });

  const duplicate = await client.mutate(SUBMIT_CONTRIBUTION_ACTION_MUTATION, {
    variables: {
      input: {
        actionId,
        evidence: {
          url: 'https://reddit.com/r/programming/comments/456',
        },
      },
    },
  });

  expect(duplicate.errors?.[0].message).toEqual('Action limit reached');

  await saveFixtures(con, ContributionAction, [
    {
      id: loveActionId,
      title: 'Leave an honest review',
      points: 0,
      evidence: {},
      metadata: { isLoveAction: true },
    },
  ]);

  const loveAction = await client.mutate(SUBMIT_CONTRIBUTION_ACTION_MUTATION, {
    variables: {
      input: {
        actionId: loveActionId,
        evidence: {},
      },
    },
  });

  expect(loveAction.errors?.[0].message).toEqual(
    'Contribution action is not rewardable',
  );
});

it('returns a randomized handful of active pool links for an action', async () => {
  await seedActions();
  await saveFixtures(con, ContributionActionLink, [
    { actionId, url: 'https://stackoverflow.com/q/1' },
    { actionId, url: 'https://stackoverflow.com/q/2' },
    { actionId, url: 'https://stackoverflow.com/q/3' },
    { actionId, url: 'https://stackoverflow.com/q/4', active: false },
  ]);

  const limited = await client.query(CONTRIBUTION_ACTION_LINKS_QUERY, {
    variables: { actionId, limit: 2 },
  });

  expect(limited.errors).toBeUndefined();
  expect(limited.data.contributionActionLinks).toHaveLength(2);

  const all = await client.query(CONTRIBUTION_ACTION_LINKS_QUERY, {
    variables: { actionId },
  });

  const urls = all.data.contributionActionLinks
    .map((link: { url: string }) => link.url)
    .sort();
  expect(urls).toEqual([
    'https://stackoverflow.com/q/1',
    'https://stackoverflow.com/q/2',
    'https://stackoverflow.com/q/3',
  ]);
});

it('updates cause preferences and claims unlocked reward tiers', async () => {
  await seedCauses();
  await saveFixtures(con, ContributionRewardTier, [
    {
      id: tierId,
      title: 'Plus boost',
      thresholdPoints: 50,
      rewardType: ContributionRewardType.PlusDays,
      metadata: { days: 30 },
    },
  ]);
  await saveFixtures(con, ContributionAction, [
    {
      id: actionId,
      title: 'Referral',
      points: 50,
      evidence: {},
    },
  ]);
  await saveFixtures(con, ContributionSubmission, [
    {
      userId,
      actionId,
      status: ContributionSubmissionStatus.Approved,
      awardedPoints: 50,
    },
  ]);

  const updated = await client.mutate(UPDATE_CAUSE_PREFERENCES_MUTATION, {
    variables: { causeIds: [secondCauseId, causeId] },
  });
  const preferences = await client.query(CONTRIBUTION_PREFERENCES_QUERY);
  const claimed = await client.mutate(CLAIM_CONTRIBUTION_REWARD_MUTATION, {
    variables: { tierId },
  });

  expect(updated.data.updateContributionCausePreferences).toEqual({ _: true });
  expect(preferences.data.contributionCausePreferences.edges).toEqual([
    { node: { id: causeId, title: 'Developer Education' } },
    { node: { id: secondCauseId, title: 'Open Source Grants' } },
  ]);
  expect(claimed.errors).toBeUndefined();
  expect(claimed.data.claimContributionReward).toMatchObject({
    status: 'fulfilled',
    tier: {
      id: tierId,
      title: 'Plus boost',
      thresholdPoints: 50,
      rewardType: 'plus_days',
      metadata: { days: 30 },
    },
  });
  expect(claimed.data.claimContributionReward.claimedAt).toBeTruthy();
  expect(claimed.data.claimContributionReward.fulfilledAt).toBeTruthy();

  const user = await con.getRepository(User).findOneByOrFail({ id: userId });
  expect(user.subscriptionFlags?.cycle).toEqual(SubscriptionCycles.Monthly);
  expect(
    new Date(user.subscriptionFlags?.giftExpirationDate ?? 0).getTime(),
  ).toBeGreaterThan(Date.now());
});

it('fulfills claimed Cores reward tiers through Njord', async () => {
  jest
    .spyOn(njordCommon, 'getNjordClient')
    .mockImplementation(() =>
      createClient(Credits, createMockNjordTransport()),
    );

  await saveFixtures(con, ContributionRewardTier, [
    {
      id: coresTierId,
      title: 'Cores boost',
      thresholdPoints: 50,
      rewardType: ContributionRewardType.Cores,
      metadata: { amount: 25 },
    },
  ]);
  await saveFixtures(con, ContributionAction, [
    {
      id: actionId,
      title: 'Referral',
      points: 50,
      evidence: {},
    },
  ]);
  await saveFixtures(con, ContributionSubmission, [
    {
      userId,
      actionId,
      status: ContributionSubmissionStatus.Approved,
      awardedPoints: 50,
    },
  ]);

  const claimed = await client.mutate(CLAIM_CONTRIBUTION_REWARD_MUTATION, {
    variables: { tierId: coresTierId },
  });

  expect(claimed.errors).toBeUndefined();
  expect(claimed.data.claimContributionReward).toMatchObject({
    status: 'fulfilled',
    tier: {
      id: coresTierId,
      title: 'Cores boost',
      thresholdPoints: 50,
      rewardType: 'cores',
      metadata: { amount: 25 },
    },
  });

  await expect(
    con.getRepository(UserTransaction).findOneByOrFail({
      receiverId: userId,
      referenceId: coresTierId,
      referenceType: UserTransactionType.ContributionReward,
    }),
  ).resolves.toMatchObject({
    processor: UserTransactionProcessor.Njord,
    status: UserTransactionStatus.Success,
    value: 25,
    valueIncFees: 25,
    fee: 0,
  });
});

it('returns finalized cause totals, user cause stats, and sponsors', async () => {
  await seedCauses();
  await saveFixtures(con, ContributionPayment, [
    {
      id: paymentId,
      status: ContributionPaymentStatus.Finalized,
      totalPoints: 100,
      amountCents: 10000,
      finalizedAt: new Date(),
    },
  ]);
  await saveFixtures(con, ContributionPaymentAllocation, [
    {
      paymentId,
      causeId,
      userId,
      points: 100,
      amountCents: 10000,
    },
  ]);
  await saveFixtures(con, ContributionSponsor, [
    {
      id: sponsorId,
      name: 'Daily Corp',
      amountCents: 250000,
      url: 'https://daily.dev',
      logoUrl: 'https://daily.dev/logo.png',
    },
  ]);

  const causes = await client.query(CONTRIBUTION_CAUSES_QUERY);
  const stats = await client.query(USER_CAUSE_STATS_QUERY);
  const sponsors = await client.query(CONTRIBUTION_SPONSORS_QUERY);

  expect(causes.data.contributionCauses.edges[0]).toEqual({
    node: {
      id: causeId,
      title: 'Developer Education',
      description: 'Helping developers learn.',
      category: 'Education',
      logoUrl: 'https://daily.dev/education.png',
      totalPoints: 100,
      totalAmountCents: 10000,
    },
  });
  expect(stats.data.userContributionCauseStats.edges).toEqual([
    {
      node: {
        points: 100,
        amountCents: 10000,
        cause: {
          id: causeId,
          title: 'Developer Education',
          description: 'Helping developers learn.',
          category: 'Education',
          logoUrl: 'https://daily.dev/education.png',
          totalPoints: 100,
          totalAmountCents: 10000,
        },
      },
    },
  ]);
  expect(sponsors.data.contributionSponsors.edges).toEqual([
    {
      node: {
        id: sponsorId,
        name: 'Daily Corp',
        amountCents: 250000,
        url: 'https://daily.dev',
        logoUrl: 'https://daily.dev/logo.png',
        tier: 'gold',
      },
    },
  ]);
});

it('exposes the sponsor wall to anonymous visitors', async () => {
  loggedUser = null;
  await saveFixtures(con, ContributionSponsor, [
    {
      id: sponsorId,
      name: 'Daily Corp',
      amountCents: 250000,
      url: 'https://daily.dev',
      logoUrl: 'https://daily.dev/logo.png',
    },
  ]);

  const sponsors = await client.query(CONTRIBUTION_SPONSORS_QUERY);

  expect(sponsors.errors).toBeUndefined();
  expect(sponsors.data.contributionSponsors.edges).toEqual([
    {
      node: {
        id: sponsorId,
        name: 'Daily Corp',
        amountCents: 250000,
        url: 'https://daily.dev',
        logoUrl: 'https://daily.dev/logo.png',
        tier: 'gold',
      },
    },
  ]);
});
