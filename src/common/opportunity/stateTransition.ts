import type { DataSource } from 'typeorm';
import type { FastifyBaseLogger } from 'fastify';
import { In } from 'typeorm';
import { OpportunityState } from '@dailydotdev/schema';
import { OpportunityJob } from '../../entity/opportunities/OpportunityJob';
import { Organization } from '../../entity/Organization';
import { QuestionScreening } from '../../entity/questions/QuestionScreening';
import { ConflictError, PaymentRequiredError } from '../../errors';
import { SubscriptionStatus } from '../plus/subscription';
import { updateFlagsStatement } from '../utils';
import { opportunityStateLiveSchema } from '../schema/opportunities';
import {
  activateSuperAgentTrial,
  applyTrialFlagsToOpportunity,
  getSuperAgentTrialConfig,
  hasActiveSuperAgentTrial,
  isFirstOpportunitySubmission,
} from './trial';

// Types for updateOpportunityState helpers
export type OpportunityWithRelations = OpportunityJob & {
  organization: Promise<Organization | null>;
  keywords: Promise<{ keyword: string }[]>;
  questions: Promise<QuestionScreening[]>;
};

export type StateUpdateContext = {
  con: DataSource;
  userId: string;
  log: FastifyBaseLogger;
  isTeamMember: boolean;
};

/**
 * Validates an opportunity can transition to IN_REVIEW state
 */
export const validateInReviewTransition = async ({
  opportunity,
  organization,
}: {
  opportunity: OpportunityWithRelations;
  organization: Organization | null;
}): Promise<void> => {
  if (!organization) {
    throw new ConflictError(`Opportunity must have an organization assigned`);
  }

  if (opportunity.state === OpportunityState.CLOSED) {
    throw new ConflictError(`Opportunity is closed`);
  }

  if (
    organization.recruiterSubscriptionFlags.status !== SubscriptionStatus.Active
  ) {
    throw new PaymentRequiredError(
      `Opportunity subscription is not active yet, make sure your payment was processed in full. Contact support if the issue persists.`,
    );
  }

  opportunityStateLiveSchema.parse({
    ...opportunity,
    organization,
    keywords: await opportunity.keywords,
    questions: await opportunity.questions,
  });
};

/**
 * Validates seat availability and returns the plan to allocate
 */
export const validateAndGetAvailablePlan = async ({
  ctx,
  organization,
}: {
  ctx: StateUpdateContext;
  organization: Organization;
}): Promise<{ priceId: string }> => {
  const liveOpportunities: Pick<OpportunityJob, 'flags'>[] = await ctx.con
    .getRepository(OpportunityJob)
    .find({
      select: ['flags'],
      where: {
        organizationId: organization.id,
        state: In([OpportunityState.LIVE, OpportunityState.IN_REVIEW]),
      },
      take: 100,
    });

  const organizationPlans = [
    ...(organization.recruiterSubscriptionFlags.items || []),
  ];

  // Decrement plan quantities based on existing live/in-review opportunities
  liveOpportunities.forEach((opp) => {
    const planPriceId = opp.flags?.plan;
    const planForOpportunity = organizationPlans.find(
      (plan) => plan.priceId === planPriceId,
    );

    if (planForOpportunity) {
      planForOpportunity.quantity -= 1;
    }
  });

  const newPlan = organizationPlans.find((plan) => plan.quantity > 0);

  if (!newPlan) {
    throw new PaymentRequiredError(
      `Your don't have any more seats available. Please update your subscription to add more seats.`,
    );
  }

  return newPlan;
};

/**
 * Handles opportunity submission to IN_REVIEW state
 * Always allocates a seat from the subscription, then optionally applies trial features
 *
 * Trial flags apply if:
 * 1. First submission (activates new trial), OR
 * 2. Org already has active trial (subsequent submissions during trial)
 */
export const handleInReviewSubmission = async ({
  ctx,
  opportunity,
  organization,
}: {
  ctx: StateUpdateContext;
  opportunity: OpportunityJob;
  organization: Organization;
}): Promise<void> => {
  // Always validate and allocate a seat first (user must have paid)
  const plan = await validateAndGetAvailablePlan({ ctx, organization });

  const trialConfig = getSuperAgentTrialConfig();
  const isFirst = trialConfig.enabled
    ? await isFirstOpportunitySubmission(ctx.con, organization.id)
    : false;

  // Trial flags apply if:
  // 1. First submission (activates new trial), OR
  // 2. Org already has active trial (subsequent submissions during trial)
  const shouldApplyTrialFlags =
    isFirst ||
    hasActiveSuperAgentTrial(organization.recruiterSubscriptionFlags);

  await ctx.con.transaction(async (manager) => {
    // Set the opportunity state and allocate the seat
    await manager.getRepository(OpportunityJob).update(
      { id: opportunity.id },
      {
        state: OpportunityState.IN_REVIEW,
        flags: updateFlagsStatement<OpportunityJob>({
          plan: plan.priceId,
        }),
      },
    );

    // If first submission, activate trial for the organization
    if (isFirst) {
      await activateSuperAgentTrial({
        con: manager,
        organizationId: organization.id,
        userId: ctx.userId,
        logger: ctx.log,
      });
    }

    // Apply trial feature flags if eligible
    if (shouldApplyTrialFlags) {
      await applyTrialFlagsToOpportunity({
        con: manager,
        opportunityId: opportunity.id,
      });
    }
  });

  if (isFirst) {
    ctx.log.info(
      {
        opportunityId: opportunity.id,
        organizationId: organization.id,
      },
      'First opportunity submission - Super Agent trial activated',
    );
  }
};

/**
 * Handles transition to LIVE state (team members only)
 */
export const handleLiveTransition = async ({
  ctx,
  opportunityId,
}: {
  ctx: StateUpdateContext;
  opportunityId: string;
}): Promise<void> => {
  if (!ctx.isTeamMember) {
    throw new ConflictError('Invalid state transition');
  }

  await ctx.con
    .getRepository(OpportunityJob)
    .update({ id: opportunityId }, { state: OpportunityState.LIVE });
};
