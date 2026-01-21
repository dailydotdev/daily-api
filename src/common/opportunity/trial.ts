import type { DataSource } from 'typeorm';
import type { FastifyBaseLogger } from 'fastify';
import { In } from 'typeorm';
import { OpportunityState } from '@dailydotdev/schema';
import { OpportunityJob } from '../../entity/opportunities/OpportunityJob';
import { Organization } from '../../entity/Organization';
import { SubscriptionStatus } from '../plus/subscription';
import { remoteConfig, type SuperAgentTrialConfig } from '../../remoteConfig';
import { Alerts } from '../../entity/Alerts';
import { updateFlagsStatement } from '../index';

const DEFAULT_TRIAL_CONFIG: SuperAgentTrialConfig = {
  enabled: false,
  durationDays: 30,
  features: {
    batchSize: 150,
    reminders: true,
    showSlack: true,
    showFeedback: true,
  },
};

export const getSuperAgentTrialConfig = (): SuperAgentTrialConfig => {
  return remoteConfig.vars.superAgentTrial ?? DEFAULT_TRIAL_CONFIG;
};

export const isSuperAgentTrialEnabled = (): boolean => {
  return getSuperAgentTrialConfig().enabled;
};

/**
 * Check if this is the organization's first opportunity submission
 * (no opportunities have previously transitioned to IN_REVIEW, LIVE, or CLOSED)
 */
export const isFirstOpportunitySubmission = async (
  con: DataSource,
  organizationId: string,
): Promise<boolean> => {
  const count = await con.getRepository(OpportunityJob).count({
    where: {
      organizationId,
      state: In([
        OpportunityState.IN_REVIEW,
        OpportunityState.LIVE,
        OpportunityState.CLOSED,
      ]),
    },
  });
  return count === 0;
};

/**
 * Activate Super Agent trial for an organization
 */
export const activateSuperAgentTrial = async ({
  con,
  organizationId,
  userId,
  logger,
}: {
  con: DataSource;
  organizationId: string;
  userId: string;
  logger: FastifyBaseLogger;
}): Promise<void> => {
  const config = getSuperAgentTrialConfig();

  const trialExpiresAt = new Date();
  trialExpiresAt.setDate(trialExpiresAt.getDate() + config.durationDays);

  const orgRepo = con.getRepository(Organization);
  const org = await orgRepo.findOneBy({ id: organizationId });

  if (!org) {
    throw new Error(`Organization ${organizationId} not found`);
  }

  const existingFlags = org.recruiterSubscriptionFlags || {};

  await orgRepo.update(organizationId, {
    recruiterSubscriptionFlags: {
      ...existingFlags,
      trialExpiresAt,
      trialPlan: existingFlags.items?.[0]?.priceId || null,
      isTrialActive: true,
      status: SubscriptionStatus.Active,
    },
  });

  // Set alert to notify user on boot
  await con
    .getRepository(Alerts)
    .upsert(
      { userId, showSuperAgentTrialUpgrade: true },
      { conflictPaths: ['userId'] },
    );

  logger.info(
    { organizationId, trialExpiresAt, userId },
    'Super Agent trial activated',
  );
};

/**
 * Apply Super Agent trial feature flags to an opportunity
 */
export const applyTrialFlagsToOpportunity = async ({
  con,
  opportunityId,
}: {
  con: DataSource;
  opportunityId: string;
}): Promise<void> => {
  const config = getSuperAgentTrialConfig();

  await con.getRepository(OpportunityJob).update(opportunityId, {
    flags: updateFlagsStatement<OpportunityJob>({
      batchSize: config.features.batchSize,
      reminders: config.features.reminders,
      showSlack: config.features.showSlack,
      showFeedback: config.features.showFeedback,
      plan: 'super_agent_trial',
    }),
  });
};

/**
 * Check if organization has an active Super Agent trial
 */
export const hasActiveSuperAgentTrial = (
  recruiterSubscriptionFlags:
    | Organization['recruiterSubscriptionFlags']
    | null
    | undefined,
): boolean => {
  if (!recruiterSubscriptionFlags?.isTrialActive) {
    return false;
  }
  if (!recruiterSubscriptionFlags.trialExpiresAt) {
    return false;
  }
  return new Date(recruiterSubscriptionFlags.trialExpiresAt) > new Date();
};
