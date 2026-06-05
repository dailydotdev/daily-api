import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import appFunc from '../src';
import type { Context } from '../src/Context';
import {
  disposeGraphQLTesting,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  type GraphQLTestClient,
  type GraphQLTestingState,
} from './helpers';
import { User } from '../src/entity/user/User';
import { ContributionAction } from '../src/entity/contribution/ContributionAction';
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
import { UserContributionCausePreference } from '../src/entity/contribution/UserContributionCausePreference';
import { UserContributionReward } from '../src/entity/contribution/UserContributionReward';
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
const causeId = '33333333-3333-4333-8333-333333333333';
const secondCauseId = '33333333-3333-4333-8333-333333333334';
const tierId = '44444444-4444-4444-8444-444444444444';
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
        maxPerUser
        userCompletions
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
        totalPoints
        totalAmountCents
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
  loggedUser = userId;
  region = 'US';

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
      sortOrder: 2,
    },
    {
      id: causeId,
      title: 'Developer Education',
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
        maxPerUser: 1,
        userCompletions: 0,
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
    userPoints: 25,
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
    status: 'claimed',
    tier: {
      id: tierId,
      title: 'Plus boost',
      thresholdPoints: 50,
      rewardType: 'plus_days',
      metadata: { days: 30 },
    },
  });
  expect(claimed.data.claimContributionReward.claimedAt).toBeTruthy();
});

it('returns finalized cause totals and user cause stats', async () => {
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

  const causes = await client.query(CONTRIBUTION_CAUSES_QUERY);
  const stats = await client.query(USER_CAUSE_STATS_QUERY);

  expect(causes.data.contributionCauses.edges[0]).toEqual({
    node: {
      id: causeId,
      title: 'Developer Education',
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
          totalPoints: 100,
          totalAmountCents: 10000,
        },
      },
    },
  ]);
});
