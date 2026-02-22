import cron from '../../src/cron/expireSuperAgentTrial';
import {
  defaultSuperAgentTrialConfig,
  expectSuccessfulCron,
  saveFixtures,
} from '../helpers';
import { Organization } from '../../src/entity';
import { OpportunityJob } from '../../src/entity/opportunities/OpportunityJob';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { addDays, subDays } from 'date-fns';
import { crons } from '../../src/cron/index';
import { SubscriptionStatus } from '../../src/common/plus/subscription';
import { OpportunityState, OpportunityType } from '@dailydotdev/schema';
import { remoteConfig } from '../../src/remoteConfig';

let con: DataSource;

// Valid UUIDs for test organizations
const testOrgIds = {
  expiredWithPlan: 'e5a70001-0000-0000-0000-000000000001',
  expiredNoPlan: 'e5a70002-0000-0000-0000-000000000002',
  activeTrial: 'e5a70003-0000-0000-0000-000000000003',
  noTrial: 'e5a70004-0000-0000-0000-000000000004',
};

// Valid UUIDs for test opportunities
const testOpIds = {
  trialLive: 'e5a70100-0000-0000-0000-000000000001',
  trialReview: 'e5a70100-0000-0000-0000-000000000002',
  trialClosed: 'e5a70100-0000-0000-0000-000000000003',
  trialDraft: 'e5a70100-0000-0000-0000-000000000004',
  paidLive: 'e5a70100-0000-0000-0000-000000000005',
  activeTrial: 'e5a70100-0000-0000-0000-000000000006',
  noTrialOrg: 'e5a70100-0000-0000-0000-000000000007',
};

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  remoteConfig.vars.superAgentTrial = defaultSuperAgentTrialConfig;

  const expiredDate = subDays(new Date(), 1);
  const futureDate = addDays(new Date(), 10);

  await saveFixtures(con, Organization, [
    {
      id: testOrgIds.expiredWithPlan,
      name: 'Expired With Plan Org ESAT',
      recruiterSubscriptionFlags: {
        isTrialActive: true,
        trialExpiresAt: expiredDate,
        trialPlan: 'pri_original_123',
        status: SubscriptionStatus.Active,
        items: [{ priceId: 'pri_original_123', quantity: 1 }],
      },
    },
    {
      id: testOrgIds.expiredNoPlan,
      name: 'Expired No Plan Org ESAT',
      recruiterSubscriptionFlags: {
        isTrialActive: true,
        trialExpiresAt: expiredDate,
        trialPlan: null,
        status: SubscriptionStatus.Active,
      },
    },
    {
      id: testOrgIds.activeTrial,
      name: 'Active Trial Org ESAT',
      recruiterSubscriptionFlags: {
        isTrialActive: true,
        trialExpiresAt: futureDate,
        trialPlan: null,
        status: SubscriptionStatus.Active,
      },
    },
    {
      id: testOrgIds.noTrial,
      name: 'No Trial Org ESAT',
      recruiterSubscriptionFlags: {
        status: SubscriptionStatus.Active,
        items: [{ priceId: 'pri_regular_123', quantity: 1 }],
      },
    },
  ]);

  // Create test opportunities
  await saveFixtures(con, OpportunityJob, [
    // Trial opportunity for expired org - should have trial features removed
    {
      id: testOpIds.trialLive,
      type: OpportunityType.JOB,
      state: OpportunityState.LIVE,
      title: 'Trial Live Op ESAT',
      tldr: 'Trial live opportunity',
      organizationId: testOrgIds.expiredNoPlan,
      flags: {
        plan: 'pri_seat_123',
        isTrial: true,
        batchSize: 150,
        reminders: true,
        showSlack: true,
        showFeedback: true,
      },
    },
    // Trial opportunity in review for expired org - should have trial features removed
    {
      id: testOpIds.trialReview,
      type: OpportunityType.JOB,
      state: OpportunityState.IN_REVIEW,
      title: 'Trial Review Op ESAT',
      tldr: 'Trial in review opportunity',
      organizationId: testOrgIds.expiredNoPlan,
      flags: {
        plan: 'pri_seat_456',
        isTrial: true,
        batchSize: 150,
        reminders: true,
        showSlack: true,
        showFeedback: true,
      },
    },
    // Trial opportunity already closed - should not be affected
    {
      id: testOpIds.trialClosed,
      type: OpportunityType.JOB,
      state: OpportunityState.CLOSED,
      title: 'Trial Closed Op ESAT',
      tldr: 'Trial closed opportunity',
      organizationId: testOrgIds.expiredNoPlan,
      flags: { plan: 'pri_seat_789', isTrial: true, batchSize: 150 },
    },
    // Trial opportunity draft - should not be affected
    {
      id: testOpIds.trialDraft,
      type: OpportunityType.JOB,
      state: OpportunityState.DRAFT,
      title: 'Trial Draft Op ESAT',
      tldr: 'Trial draft opportunity',
      organizationId: testOrgIds.expiredNoPlan,
      flags: { plan: 'pri_seat_abc', isTrial: true, batchSize: 150 },
    },
    // Paid opportunity without trial for expired org - should not be affected
    {
      id: testOpIds.paidLive,
      type: OpportunityType.JOB,
      state: OpportunityState.LIVE,
      title: 'Paid Live Op ESAT',
      tldr: 'Paid live opportunity',
      organizationId: testOrgIds.expiredWithPlan,
      flags: { plan: 'pri_original_123', batchSize: 200 },
    },
    // Trial opportunity for active trial org - should not be affected
    {
      id: testOpIds.activeTrial,
      type: OpportunityType.JOB,
      state: OpportunityState.LIVE,
      title: 'Active Trial Op ESAT',
      tldr: 'Active trial opportunity',
      organizationId: testOrgIds.activeTrial,
      flags: { plan: 'pri_seat_xyz', isTrial: true, batchSize: 150 },
    },
    // Opportunity for non-trial org - should not be affected
    {
      id: testOpIds.noTrialOrg,
      type: OpportunityType.JOB,
      state: OpportunityState.LIVE,
      title: 'No Trial Org Op ESAT',
      tldr: 'No trial org opportunity',
      organizationId: testOrgIds.noTrial,
      flags: { plan: 'pri_regular_123', batchSize: 100 },
    },
  ]);
});

afterEach(() => {
  remoteConfig.vars.superAgentTrial = undefined;
});

describe('expireSuperAgentTrial cron', () => {
  it('should be registered', () => {
    const registeredWorker = crons.find((item) => item.name === cron.name);
    expect(registeredWorker).toBeDefined();
  });

  it('should expire trials past their expiration date and handle based on original plan', async () => {
    await expectSuccessfulCron(cron);

    // Verify expired trial with original plan - keeps active status
    const expiredWithPlan = await con
      .getRepository(Organization)
      .findOneBy({ id: testOrgIds.expiredWithPlan });
    expect(expiredWithPlan?.recruiterSubscriptionFlags).toMatchObject({
      isTrialActive: false,
      status: SubscriptionStatus.Active,
    });
    expect(
      expiredWithPlan?.recruiterSubscriptionFlags.trialExpiresAt,
    ).toBeNull();
    expect(expiredWithPlan?.recruiterSubscriptionFlags.trialPlan).toBeNull();

    // Verify expired trial without original plan - downgrades to none
    const expiredNoPlan = await con
      .getRepository(Organization)
      .findOneBy({ id: testOrgIds.expiredNoPlan });
    expect(expiredNoPlan?.recruiterSubscriptionFlags).toMatchObject({
      isTrialActive: false,
      status: SubscriptionStatus.None,
    });

    // Verify active trial was not affected
    const activeTrial = await con
      .getRepository(Organization)
      .findOneBy({ id: testOrgIds.activeTrial });
    expect(activeTrial?.recruiterSubscriptionFlags).toMatchObject({
      isTrialActive: true,
      status: SubscriptionStatus.Active,
    });
    expect(
      activeTrial?.recruiterSubscriptionFlags.trialExpiresAt,
    ).toBeDefined();

    // Verify org without trial was not affected
    const noTrial = await con
      .getRepository(Organization)
      .findOneBy({ id: testOrgIds.noTrial });
    expect(noTrial?.recruiterSubscriptionFlags).toMatchObject({
      status: SubscriptionStatus.Active,
    });
    expect(noTrial?.recruiterSubscriptionFlags.isTrialActive).toBeFalsy();
  });

  it('should remove trial features from opportunities for expired orgs but preserve state and plan', async () => {
    await expectSuccessfulCron(cron);

    const opportunityRepo = con.getRepository(OpportunityJob);

    // Trial LIVE opportunity for expired org - should remain LIVE but have trial features removed
    // and batchSize reset to default (50)
    const trialLive = await opportunityRepo.findOneBy({
      id: testOpIds.trialLive,
    });
    expect(trialLive?.state).toBe(OpportunityState.LIVE);
    expect(trialLive?.flags?.plan).toBe('pri_seat_123'); // plan preserved
    expect(trialLive?.flags?.isTrial).toBeUndefined(); // trial features removed
    expect(trialLive?.flags?.batchSize).toBe(50); // reset to default
    expect(trialLive?.flags?.reminders).toBeUndefined();
    expect(trialLive?.flags?.showSlack).toBeUndefined();
    expect(trialLive?.flags?.showFeedback).toBeUndefined();

    // Trial IN_REVIEW opportunity for expired org - should remain IN_REVIEW but have trial features removed
    const trialReview = await opportunityRepo.findOneBy({
      id: testOpIds.trialReview,
    });
    expect(trialReview?.state).toBe(OpportunityState.IN_REVIEW);
    expect(trialReview?.flags?.plan).toBe('pri_seat_456'); // plan preserved
    expect(trialReview?.flags?.isTrial).toBeUndefined(); // trial features removed
    expect(trialReview?.flags?.batchSize).toBe(50); // reset to default

    // Trial CLOSED opportunity - should remain closed and have trial features intact (not affected)
    const trialClosed = await opportunityRepo.findOneBy({
      id: testOpIds.trialClosed,
    });
    expect(trialClosed?.state).toBe(OpportunityState.CLOSED);
    expect(trialClosed?.flags?.isTrial).toBe(true); // not affected since already closed

    // Trial DRAFT opportunity - should remain draft and have trial features intact (not affected)
    const trialDraft = await opportunityRepo.findOneBy({
      id: testOpIds.trialDraft,
    });
    expect(trialDraft?.state).toBe(OpportunityState.DRAFT);
    expect(trialDraft?.flags?.isTrial).toBe(true); // not affected since draft

    // Paid opportunity without trial for expired org - should remain unchanged
    const paidLive = await opportunityRepo.findOneBy({
      id: testOpIds.paidLive,
    });
    expect(paidLive?.state).toBe(OpportunityState.LIVE);
    expect(paidLive?.flags?.plan).toBe('pri_original_123');
    expect(paidLive?.flags?.batchSize).toBe(200); // batchSize preserved (not a trial feature here)

    // Trial opportunity for active trial org - should remain unchanged
    const activeTrial = await opportunityRepo.findOneBy({
      id: testOpIds.activeTrial,
    });
    expect(activeTrial?.state).toBe(OpportunityState.LIVE);
    expect(activeTrial?.flags?.isTrial).toBe(true); // trial still active

    // Opportunity for non-trial org - should remain unchanged
    const noTrialOp = await opportunityRepo.findOneBy({
      id: testOpIds.noTrialOrg,
    });
    expect(noTrialOp?.state).toBe(OpportunityState.LIVE);
    expect(noTrialOp?.flags?.batchSize).toBe(100);
  });

  it('should clear showSuperAgentTrialUpgrade alerts for recruiters on expired trial opportunities', async () => {
    // Import needed entities for this test
    const { Alerts, User } = await import('../../src/entity');
    const { OpportunityUserRecruiter } =
      await import('../../src/entity/opportunities/user/OpportunityUserRecruiter');
    const { OpportunityUserType } =
      await import('../../src/entity/opportunities/types');
    const { usersFixture } = await import('../fixture');

    // Create users
    await saveFixtures(con, User, usersFixture);

    // Create recruiter relationships for trial opportunities
    await saveFixtures(con, OpportunityUserRecruiter, [
      // User 1 is recruiter on trial opportunity for expired org
      {
        opportunityId: testOpIds.trialLive,
        userId: '1',
        type: OpportunityUserType.Recruiter,
      },
      // User 2 is recruiter on trial opportunity for active trial org (not affected)
      {
        opportunityId: testOpIds.activeTrial,
        userId: '2',
        type: OpportunityUserType.Recruiter,
      },
      // User 3 is recruiter on paid opportunity (not affected)
      {
        opportunityId: testOpIds.paidLive,
        userId: '3',
        type: OpportunityUserType.Recruiter,
      },
    ]);

    // Create alerts with showSuperAgentTrialUpgrade = true
    const alertsRepo = con.getRepository(Alerts);
    await alertsRepo.save([
      { userId: '1', showSuperAgentTrialUpgrade: true },
      { userId: '2', showSuperAgentTrialUpgrade: true },
      { userId: '3', showSuperAgentTrialUpgrade: true },
    ]);

    await expectSuccessfulCron(cron);

    // User 1's alert should be cleared (recruiter on expired trial)
    const alert1 = await alertsRepo.findOneBy({ userId: '1' });
    expect(alert1?.showSuperAgentTrialUpgrade).toBe(false);

    // User 2's alert should NOT be cleared (recruiter on active trial)
    const alert2 = await alertsRepo.findOneBy({ userId: '2' });
    expect(alert2?.showSuperAgentTrialUpgrade).toBe(true);

    // User 3's alert should NOT be cleared (recruiter on paid opportunity)
    const alert3 = await alertsRepo.findOneBy({ userId: '3' });
    expect(alert3?.showSuperAgentTrialUpgrade).toBe(true);
  });
});
