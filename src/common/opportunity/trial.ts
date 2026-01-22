import type { DataSource, EntityManager } from 'typeorm';
import type { FastifyBaseLogger } from 'fastify';
import { Not } from 'typeorm';
import { OpportunityState } from '@dailydotdev/schema';
import { OpportunityJob } from '../../entity/opportunities/OpportunityJob';
import { Organization } from '../../entity/Organization';
import { SubscriptionStatus } from '../plus/subscription';
import { remoteConfig, type SuperAgentTrialConfig } from '../../remoteConfig';
import { Alerts } from '../../entity/Alerts';
import {
  updateFlagsStatement,
  updateRecruiterSubscriptionFlags,
} from '../index';

type DataSourceOrManager = DataSource | EntityManager;

const DEFAULT_TRIAL_CONFIG: SuperAgentTrialConfig = {
  enabled: false,
};

export const getSuperAgentTrialConfig = (): SuperAgentTrialConfig => {
  return remoteConfig.vars.superAgentTrial ?? DEFAULT_TRIAL_CONFIG;
};

/**
 * Check if this is the organization's first opportunity submission
 * (no opportunities have previously transitioned to IN_REVIEW, LIVE, or CLOSED)
 */
export const isFirstOpportunitySubmission = async (
  con: DataSourceOrManager,
  organizationId: string,
): Promise<boolean> => {
  const count = await con.getRepository(OpportunityJob).count({
    where: {
      organizationId,
      state: Not(OpportunityState.DRAFT),
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
  con: DataSourceOrManager;
  organizationId: string;
  userId: string;
  logger: FastifyBaseLogger;
}): Promise<void> => {
  const config = getSuperAgentTrialConfig();
  if (!config.enabled) {
    return;
  }

  const trialExpiresAt = new Date();
  trialExpiresAt.setDate(trialExpiresAt.getDate() + config.durationDays);

  const orgRepo = con.getRepository(Organization);
  const org = await orgRepo.findOne({
    select: ['id', 'recruiterSubscriptionFlags'],
    where: { id: organizationId },
  });

  if (!org) {
    throw new Error(`Organization ${organizationId} not found`);
  }

  const existingFlags = org.recruiterSubscriptionFlags || {};

  await orgRepo.update(organizationId, {
    recruiterSubscriptionFlags: updateRecruiterSubscriptionFlags<Organization>({
      trialExpiresAt,
      trialPlan: existingFlags.items?.[0]?.priceId || null,
      isTrialActive: true,
      status: SubscriptionStatus.Active,
    }),
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
  con: DataSourceOrManager;
  opportunityId: string;
}): Promise<void> => {
  const config = getSuperAgentTrialConfig();
  if (!config.enabled || !config.features) {
    return;
  }

  await con.getRepository(OpportunityJob).update(opportunityId, {
    flags: updateFlagsStatement<OpportunityJob>({
      ...config.features,
      isTrial: true,
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
