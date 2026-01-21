import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { saveFixtures } from '../../helpers';
import { Alerts, User } from '../../../src/entity';
import { Organization } from '../../../src/entity/Organization';
import { OpportunityJob } from '../../../src/entity/opportunities/OpportunityJob';
import { usersFixture } from '../../fixture';
import { OpportunityState, OpportunityType } from '@dailydotdev/schema';
import { SubscriptionStatus } from '../../../src/common/plus/subscription';
import { addDays, subDays } from 'date-fns';
import {
  activateSuperAgentTrial,
  applyTrialFlagsToOpportunity,
  hasActiveSuperAgentTrial,
  isFirstOpportunitySubmission,
} from '../../../src/common/opportunity/trial';
import { remoteConfig } from '../../../src/remoteConfig';

let con: DataSource;

// UUID base for test IDs (will append different digits for each test entity)
const testUuidBase = 'a0000000-0000-0000-0000-00000000000';

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as unknown as Parameters<typeof activateSuperAgentTrial>[0]['logger'];

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await saveFixtures(con, User, usersFixture);
  jest.clearAllMocks();
});

describe('isFirstOpportunitySubmission', () => {
  it('should return true for org with no opportunities and false for org with submitted opportunities', async () => {
    // Create organizations for testing
    await saveFixtures(con, Organization, [
      { id: `${testUuidBase}1`, name: 'No Ops Org SAT' },
      { id: `${testUuidBase}2`, name: 'Draft Only Org SAT' },
      { id: `${testUuidBase}3`, name: 'In Review Org SAT' },
      { id: `${testUuidBase}4`, name: 'Live Org SAT' },
      { id: `${testUuidBase}5`, name: 'Closed Org SAT' },
    ]);

    // Create opportunities for each org
    await saveFixtures(con, OpportunityJob, [
      {
        id: `${testUuidBase}a`,
        type: OpportunityType.JOB,
        state: OpportunityState.DRAFT,
        title: 'Draft Op SAT',
        tldr: 'Draft opportunity for testing',
        organizationId: `${testUuidBase}2`,
      },
      {
        id: `${testUuidBase}b`,
        type: OpportunityType.JOB,
        state: OpportunityState.IN_REVIEW,
        title: 'In Review Op SAT',
        tldr: 'In review opportunity for testing',
        organizationId: `${testUuidBase}3`,
      },
      {
        id: `${testUuidBase}c`,
        type: OpportunityType.JOB,
        state: OpportunityState.LIVE,
        title: 'Live Op SAT',
        tldr: 'Live opportunity for testing',
        organizationId: `${testUuidBase}4`,
      },
      {
        id: `${testUuidBase}d`,
        type: OpportunityType.JOB,
        state: OpportunityState.CLOSED,
        title: 'Closed Op SAT',
        tldr: 'Closed opportunity for testing',
        organizationId: `${testUuidBase}5`,
      },
    ]);

    // Test with no opportunities - should be first
    expect(await isFirstOpportunitySubmission(con, `${testUuidBase}1`)).toBe(
      true,
    );

    // Test with DRAFT only - should still be first
    expect(await isFirstOpportunitySubmission(con, `${testUuidBase}2`)).toBe(
      true,
    );

    // Test with IN_REVIEW - not first
    expect(await isFirstOpportunitySubmission(con, `${testUuidBase}3`)).toBe(
      false,
    );

    // Test with LIVE - not first
    expect(await isFirstOpportunitySubmission(con, `${testUuidBase}4`)).toBe(
      false,
    );

    // Test with CLOSED - not first
    expect(await isFirstOpportunitySubmission(con, `${testUuidBase}5`)).toBe(
      false,
    );
  });
});

describe('activateSuperAgentTrial', () => {
  beforeEach(() => {
    remoteConfig.vars.superAgentTrial = {
      enabled: true,
      durationDays: 30,
      features: {
        batchSize: 150,
        reminders: true,
        showSlack: true,
        showFeedback: true,
      },
    };
  });

  afterEach(() => {
    remoteConfig.vars.superAgentTrial = undefined;
  });

  it('should set trial flags, preserve existing subscription info, and create alert for user', async () => {
    // Test both scenarios: new org and org with existing subscription
    await saveFixtures(con, Organization, [
      {
        id: `${testUuidBase}6`,
        name: 'Trial Test Org SAT',
        recruiterSubscriptionFlags: {},
      },
      {
        id: `${testUuidBase}7`,
        name: 'Existing Plan Org SAT',
        recruiterSubscriptionFlags: {
          subscriptionId: 'sub_existing',
          items: [{ priceId: 'pri_original', quantity: 2 }],
          status: SubscriptionStatus.Active,
        },
      },
    ]);

    // Activate trial for new org
    await activateSuperAgentTrial({
      con,
      organizationId: `${testUuidBase}6`,
      userId: '1',
      logger: mockLogger,
    });

    // Verify new org got trial flags
    const newOrg = await con
      .getRepository(Organization)
      .findOneBy({ id: `${testUuidBase}6` });
    expect(newOrg?.recruiterSubscriptionFlags).toMatchObject({
      isTrialActive: true,
      status: SubscriptionStatus.Active,
    });
    expect(newOrg?.recruiterSubscriptionFlags.trialExpiresAt).toBeDefined();
    expect(
      new Date(newOrg!.recruiterSubscriptionFlags.trialExpiresAt!).getTime(),
    ).toBeGreaterThan(Date.now());

    // Verify alert was set for user 1
    const alert = await con.getRepository(Alerts).findOneBy({ userId: '1' });
    expect(alert?.showSuperAgentTrialUpgrade).toBe(true);

    // Activate trial for org with existing subscription
    await activateSuperAgentTrial({
      con,
      organizationId: `${testUuidBase}7`,
      userId: '2',
      logger: mockLogger,
    });

    // Verify existing subscription info was preserved
    const existingOrg = await con
      .getRepository(Organization)
      .findOneBy({ id: `${testUuidBase}7` });
    expect(existingOrg?.recruiterSubscriptionFlags).toMatchObject({
      subscriptionId: 'sub_existing',
      trialPlan: 'pri_original',
      isTrialActive: true,
      items: [{ priceId: 'pri_original', quantity: 2 }],
    });
  });
});

describe('applyTrialFlagsToOpportunity', () => {
  beforeEach(() => {
    remoteConfig.vars.superAgentTrial = {
      enabled: true,
      durationDays: 30,
      features: {
        batchSize: 150,
        reminders: true,
        showSlack: true,
        showFeedback: true,
      },
    };
  });

  afterEach(() => {
    remoteConfig.vars.superAgentTrial = undefined;
  });

  it('should set Super Agent feature flags on opportunity', async () => {
    await saveFixtures(con, Organization, [
      {
        id: `${testUuidBase}8`,
        name: 'Op Flags Org SAT',
      },
    ]);

    await saveFixtures(con, OpportunityJob, [
      {
        id: `${testUuidBase}e`,
        type: OpportunityType.JOB,
        state: OpportunityState.DRAFT,
        title: 'Test Op SAT',
        tldr: 'Test opportunity for flags',
        organizationId: `${testUuidBase}8`,
        flags: { existing: 'value' },
      },
    ]);

    await applyTrialFlagsToOpportunity({
      con,
      opportunityId: `${testUuidBase}e`,
    });

    const op = await con
      .getRepository(OpportunityJob)
      .findOneBy({ id: `${testUuidBase}e` });
    expect(op?.flags).toMatchObject({
      existing: 'value',
      batchSize: 150,
      reminders: true,
      showSlack: true,
      showFeedback: true,
      isTrial: true,
    });
  });
});

describe('hasActiveSuperAgentTrial', () => {
  it('should correctly identify active vs expired/inactive trials', () => {
    const futureDate = addDays(new Date(), 10);
    const pastDate = subDays(new Date(), 1);

    // Active trial
    expect(
      hasActiveSuperAgentTrial({
        isTrialActive: true,
        trialExpiresAt: futureDate,
      }),
    ).toBe(true);

    // Expired trial
    expect(
      hasActiveSuperAgentTrial({
        isTrialActive: true,
        trialExpiresAt: pastDate,
      }),
    ).toBe(false);

    // Inactive trial with future date
    expect(
      hasActiveSuperAgentTrial({
        isTrialActive: false,
        trialExpiresAt: futureDate,
      }),
    ).toBe(false);

    // No trial data
    expect(hasActiveSuperAgentTrial({})).toBe(false);
    expect(hasActiveSuperAgentTrial(null)).toBe(false);
    expect(hasActiveSuperAgentTrial(undefined)).toBe(false);

    // Missing expiration date
    expect(hasActiveSuperAgentTrial({ isTrialActive: true })).toBe(false);
  });
});
