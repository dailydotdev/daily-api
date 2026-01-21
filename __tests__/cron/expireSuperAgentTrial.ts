import cron from '../../src/cron/expireSuperAgentTrial';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import { Organization } from '../../src/entity/Organization';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { addDays, subDays } from 'date-fns';
import { crons } from '../../src/cron/index';
import { SubscriptionStatus } from '../../src/common/plus/subscription';

let con: DataSource;

const testOrgPrefix = 'esat-'; // expire-super-agent-trial prefix

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
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
});
