import { DataSource, In } from 'typeorm';
import worker from '../../src/workers/userActivatedContributionReferral';
import { ChangeObject } from '../../src/types';
import { expectSuccessfulTypedBackground, saveFixtures } from '../helpers';
import { User } from '../../src/entity';
import { PubSubSchema } from '../../src/common';
import { typedWorkers } from '../../src/workers';
import createOrGetConnection from '../../src/db';
import { remoteConfig } from '../../src/remoteConfig';
import {
  ContributionAction,
  ContributionAssistType,
} from '../../src/entity/contribution/ContributionAction';
import { ContributionCause } from '../../src/entity/contribution/ContributionCause';
import { UserContributionCausePreference } from '../../src/entity/contribution/UserContributionCausePreference';
import { ContributionBlockedUser } from '../../src/entity/contribution/ContributionBlockedUser';
import {
  ContributionSubmission,
  ContributionSubmissionStatus,
} from '../../src/entity/contribution/ContributionSubmission';

let con: DataSource;

const referrerId = '99999999-9999-4999-8999-999999999990';
const refereeId = '99999999-9999-4999-8999-999999999991';
const causeId = '33333333-3333-4333-8333-333333333333';
const actionId = '22222222-2222-4222-8222-222222222222';

beforeAll(async () => {
  con = await createOrGetConnection();
});

const seedReferralAction = async (
  overrides: Partial<ContributionAction> = {},
) => {
  await saveFixtures(con, ContributionAction, [
    {
      id: actionId,
      title: 'Invite a friend to daily.dev',
      points: 150,
      evidence: {},
      metadata: { assistType: ContributionAssistType.ReferralLink },
      ...overrides,
    },
  ]);
};

beforeEach(async () => {
  await con
    .getRepository(ContributionSubmission)
    .delete({ userId: referrerId });
  await con
    .getRepository(UserContributionCausePreference)
    .delete({ userId: referrerId });
  await con
    .getRepository(ContributionBlockedUser)
    .delete({ userId: referrerId });
  await con.getRepository(ContributionAction).delete({ id: actionId });
  await con.getRepository(ContributionCause).delete({ id: causeId });
  await con.getRepository(User).delete({ id: In([referrerId, refereeId]) });

  remoteConfig.vars.contributionProgram = {
    enabled: true,
    allowedCountries: ['US'],
    currentCycleTargetPoints: 10000,
  };

  await saveFixtures(con, User, [
    { id: referrerId, reputation: 10 },
    { id: refereeId, referralId: referrerId, reputation: 10 },
  ]);
  await saveFixtures(con, ContributionCause, [{ id: causeId, title: 'OSS' }]);
  await saveFixtures(con, UserContributionCausePreference, [
    { userId: referrerId, causeId },
  ]);
});

const inactiveReferee: ChangeObject<User> = {
  id: refereeId,
  referralId: referrerId,
  infoConfirmed: false,
  emailConfirmed: false,
} as unknown as ChangeObject<User>;

const activeReferee: ChangeObject<User> = {
  ...inactiveReferee,
  infoConfirmed: true,
  emailConfirmed: true,
};

const runActivation = (
  newProfile: ChangeObject<User> = activeReferee,
  user: ChangeObject<User> = inactiveReferee,
) =>
  expectSuccessfulTypedBackground(worker, {
    newProfile,
    user,
  } as unknown as PubSubSchema['user-updated']);

const getReferrerSubmissions = () =>
  con
    .getRepository(ContributionSubmission)
    .find({ where: { userId: referrerId } });

describe('userActivatedContributionReferral', () => {
  it('should be registered', () => {
    const registered = typedWorkers.find(
      (item) => item.subscription === worker.subscription,
    );
    expect(registered).toBeDefined();
  });

  it('awards the referrer when the referee activates', async () => {
    await seedReferralAction();

    await runActivation();

    const submissions = await getReferrerSubmissions();
    expect(submissions).toHaveLength(1);
    expect(submissions[0]).toMatchObject({
      actionId,
      status: ContributionSubmissionStatus.Approved,
      awardedPoints: 150,
      flags: { refereeId },
    });
  });

  it('does not award when there is no activation transition', async () => {
    await seedReferralAction();

    await runActivation(activeReferee, activeReferee);

    expect(await getReferrerSubmissions()).toHaveLength(0);
  });

  it('does not award when the referee has no referrer', async () => {
    await seedReferralAction();

    const noReferral = { ...activeReferee, referralId: null };
    await runActivation(
      noReferral as unknown as ChangeObject<User>,
      { ...inactiveReferee, referralId: null } as unknown as ChangeObject<User>,
    );

    expect(await getReferrerSubmissions()).toHaveLength(0);
  });

  it('does not award when the referrer has not joined the campaign', async () => {
    await seedReferralAction();
    await con
      .getRepository(UserContributionCausePreference)
      .delete({ userId: referrerId });

    await runActivation();

    expect(await getReferrerSubmissions()).toHaveLength(0);
  });

  it('does not award when no referral action is configured', async () => {
    await runActivation();

    expect(await getReferrerSubmissions()).toHaveLength(0);
  });

  it('is idempotent across redelivered activation events', async () => {
    await seedReferralAction();

    await runActivation();
    await runActivation();

    expect(await getReferrerSubmissions()).toHaveLength(1);
  });

  it('respects the action cap', async () => {
    await seedReferralAction({ maxPerUser: 1 });
    await con.getRepository(ContributionSubmission).save({
      userId: referrerId,
      actionId,
      status: ContributionSubmissionStatus.Approved,
      awardedPoints: 150,
      evidence: {},
      flags: { refereeId: 'some-other-referee' },
    });

    await runActivation();

    expect(await getReferrerSubmissions()).toHaveLength(1);
  });
});
