import cron from '../../src/cron/expireSuperAgentTrial';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
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

const testOrgPrefix = 'esat-'; // expire-super-agent-trial prefix
// UUID base for test opportunity IDs (valid UUID format)
const testOpBase = 'e5a70000-0000-0000-0000-00000000000';

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  // Enable Super Agent trial for tests
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

  const expiredDate = subDays(new Date(), 1);
  const futureDate = addDays(new Date(), 10);

  await saveFixtures(con, Organization, [
    {
      id: `${testOrgPrefix}expired-with-plan`,
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
      id: `${testOrgPrefix}expired-no-plan`,
      name: 'Expired No Plan Org ESAT',
      recruiterSubscriptionFlags: {
        isTrialActive: true,
        trialExpiresAt: expiredDate,
        trialPlan: null,
        status: SubscriptionStatus.Active,
      },
    },
    {
      id: `${testOrgPrefix}active-trial`,
      name: 'Active Trial Org ESAT',
      recruiterSubscriptionFlags: {
        isTrialActive: true,
        trialExpiresAt: futureDate,
        trialPlan: null,
        status: SubscriptionStatus.Active,
      },
    },
    {
      id: `${testOrgPrefix}no-trial`,
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
      id: `${testOpBase}1`,
      type: OpportunityType.JOB,
      state: OpportunityState.LIVE,
      title: 'Trial Live Op ESAT',
      tldr: 'Trial live opportunity',
      organizationId: `${testOrgPrefix}expired-no-plan`,
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
      id: `${testOpBase}2`,
      type: OpportunityType.JOB,
      state: OpportunityState.IN_REVIEW,
      title: 'Trial Review Op ESAT',
      tldr: 'Trial in review opportunity',
      organizationId: `${testOrgPrefix}expired-no-plan`,
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
      id: `${testOpBase}3`,
      type: OpportunityType.JOB,
      state: OpportunityState.CLOSED,
      title: 'Trial Closed Op ESAT',
      tldr: 'Trial closed opportunity',
      organizationId: `${testOrgPrefix}expired-no-plan`,
      flags: { plan: 'pri_seat_789', isTrial: true, batchSize: 150 },
    },
    // Trial opportunity draft - should not be affected
    {
      id: `${testOpBase}4`,
      type: OpportunityType.JOB,
      state: OpportunityState.DRAFT,
      title: 'Trial Draft Op ESAT',
      tldr: 'Trial draft opportunity',
      organizationId: `${testOrgPrefix}expired-no-plan`,
      flags: { plan: 'pri_seat_abc', isTrial: true, batchSize: 150 },
    },
    // Paid opportunity without trial for expired org - should not be affected
    {
      id: `${testOpBase}5`,
      type: OpportunityType.JOB,
      state: OpportunityState.LIVE,
      title: 'Paid Live Op ESAT',
      tldr: 'Paid live opportunity',
      organizationId: `${testOrgPrefix}expired-with-plan`,
      flags: { plan: 'pri_original_123', batchSize: 200 },
    },
    // Trial opportunity for active trial org - should not be affected
    {
      id: `${testOpBase}6`,
      type: OpportunityType.JOB,
      state: OpportunityState.LIVE,
      title: 'Active Trial Op ESAT',
      tldr: 'Active trial opportunity',
      organizationId: `${testOrgPrefix}active-trial`,
      flags: { plan: 'pri_seat_xyz', isTrial: true, batchSize: 150 },
    },
    // Opportunity for non-trial org - should not be affected
    {
      id: `${testOpBase}7`,
      type: OpportunityType.JOB,
      state: OpportunityState.LIVE,
      title: 'No Trial Org Op ESAT',
      tldr: 'No trial org opportunity',
      organizationId: `${testOrgPrefix}no-trial`,
      flags: { plan: 'pri_regular_123', batchSize: 100 },
    },
  ]);
});

afterEach(() => {
  // @ts-expect-error - resetting to undefined for tests
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
      .findOneBy({ id: `${testOrgPrefix}expired-with-plan` });
    expect(expiredWithPlan?.recruiterSubscriptionFlags).toMatchObject({
      isTrialActive: false,
      status: SubscriptionStatus.Active,
    });
    expect(
      expiredWithPlan?.recruiterSubscriptionFlags.trialExpiresAt,
    ).toBeUndefined();
    expect(
      expiredWithPlan?.recruiterSubscriptionFlags.trialPlan,
    ).toBeUndefined();

    // Verify expired trial without original plan - downgrades to none
    const expiredNoPlan = await con
      .getRepository(Organization)
      .findOneBy({ id: `${testOrgPrefix}expired-no-plan` });
    expect(expiredNoPlan?.recruiterSubscriptionFlags).toMatchObject({
      isTrialActive: false,
      status: SubscriptionStatus.None,
    });

    // Verify active trial was not affected
    const activeTrial = await con
      .getRepository(Organization)
      .findOneBy({ id: `${testOrgPrefix}active-trial` });
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
      .findOneBy({ id: `${testOrgPrefix}no-trial` });
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
      id: `${testOpBase}1`,
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
      id: `${testOpBase}2`,
    });
    expect(trialReview?.state).toBe(OpportunityState.IN_REVIEW);
    expect(trialReview?.flags?.plan).toBe('pri_seat_456'); // plan preserved
    expect(trialReview?.flags?.isTrial).toBeUndefined(); // trial features removed
    expect(trialReview?.flags?.batchSize).toBe(50); // reset to default

    // Trial CLOSED opportunity - should remain closed and have trial features intact (not affected)
    const trialClosed = await opportunityRepo.findOneBy({
      id: `${testOpBase}3`,
    });
    expect(trialClosed?.state).toBe(OpportunityState.CLOSED);
    expect(trialClosed?.flags?.isTrial).toBe(true); // not affected since already closed

    // Trial DRAFT opportunity - should remain draft and have trial features intact (not affected)
    const trialDraft = await opportunityRepo.findOneBy({
      id: `${testOpBase}4`,
    });
    expect(trialDraft?.state).toBe(OpportunityState.DRAFT);
    expect(trialDraft?.flags?.isTrial).toBe(true); // not affected since draft

    // Paid opportunity without trial for expired org - should remain unchanged
    const paidLive = await opportunityRepo.findOneBy({
      id: `${testOpBase}5`,
    });
    expect(paidLive?.state).toBe(OpportunityState.LIVE);
    expect(paidLive?.flags?.plan).toBe('pri_original_123');
    expect(paidLive?.flags?.batchSize).toBe(200); // batchSize preserved (not a trial feature here)

    // Trial opportunity for active trial org - should remain unchanged
    const activeTrial = await opportunityRepo.findOneBy({
      id: `${testOpBase}6`,
    });
    expect(activeTrial?.state).toBe(OpportunityState.LIVE);
    expect(activeTrial?.flags?.isTrial).toBe(true); // trial still active

    // Opportunity for non-trial org - should remain unchanged
    const noTrialOp = await opportunityRepo.findOneBy({
      id: `${testOpBase}7`,
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
        opportunityId: `${testOpBase}1`,
        userId: '1',
        type: OpportunityUserType.Recruiter,
      },
      // User 2 is recruiter on trial opportunity for active trial org (not affected)
      {
        opportunityId: `${testOpBase}6`,
        userId: '2',
        type: OpportunityUserType.Recruiter,
      },
      // User 3 is recruiter on paid opportunity (not affected)
      {
        opportunityId: `${testOpBase}5`,
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
