import { DataSource } from 'typeorm';
import { FastifyBaseLogger } from 'fastify';
import {
  CandidateAcceptedOpportunityMessage,
  CandidatePreferenceUpdated,
  OpportunityMessage,
  UserCV,
} from '@dailydotdev/schema';
import { triggerTypedEvent } from '../../common';
import { getSecondsTimestamp } from '../date';
import { UserCandidatePreference } from '../../entity/user/UserCandidatePreference';
import { ChangeObject } from '../../types';
import { OpportunityMatch } from '../../entity/OpportunityMatch';
import { OpportunityJob } from '../../entity/opportunities/OpportunityJob';

export const notifyOpportunityMatchAccepted = async ({
  con,
  logger,
  data,
}: {
  con: DataSource;
  logger: FastifyBaseLogger;
  data: ChangeObject<OpportunityMatch> | null;
}) => {
  if (!data) {
    logger.warn('No data provided for opportunity match accepted notification');
    return;
  }
  const candidatePreference = await con
    .getRepository(UserCandidatePreference)
    .findOneBy({
      userId: data.userId,
    });

  if (!candidatePreference) {
    logger.warn(
      { userId: data.userId },
      'Candidate preference not found for user accepting opportunity',
    );
    return;
  }

  const message = new CandidateAcceptedOpportunityMessage({
    opportunityId: data.opportunityId,
    userId: data.userId,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    screening: data.screening,
    candidatePreference: {
      ...candidatePreference,
      cv: {
        ...candidatePreference.cv,
        lastModified: getSecondsTimestamp(candidatePreference.cv.lastModified),
      },
      updatedAt: getSecondsTimestamp(candidatePreference.updatedAt),
    },
  });

  try {
    await triggerTypedEvent(
      logger,
      'api.v1.candidate-accepted-opportunity',
      message,
    );
  } catch (_err) {
    const err = _err as Error;
    logger.error(
      { err, message },
      'failed to send opportunity match accepted event',
    );
  }
};

export const notifyJobOpportunity = async ({
  con,
  logger,
  isUpdate,
  opportunityId,
}: {
  con: DataSource;
  logger: FastifyBaseLogger;
  isUpdate: boolean;
  opportunityId: string;
}) => {
  const topicName = isUpdate
    ? 'api.v1.opportunity-updated'
    : 'api.v1.opportunity-added';

  const opportunity = await con.getRepository(OpportunityJob).findOneOrFail({
    where: { id: opportunityId },
    relations: {
      organization: true,
      keywords: true,
    },
  });

  const [organization, keywords] = await Promise.all([
    opportunity.organization,
    opportunity.keywords,
  ]);

  if (!organization) {
    logger.warn(
      {
        opportunityId: opportunity.id,
        organizationId: opportunity.organizationId,
      },
      'opportunity has no organization, skipping',
    );
    return;
  }

  const message = new OpportunityMessage({
    opportunity: {
      ...opportunity,
      createdAt: getSecondsTimestamp(opportunity.createdAt),
      updatedAt: getSecondsTimestamp(opportunity.updatedAt),
      keywords: keywords.map((k) => k.keyword),
    },
    organization: {
      ...organization,
      createdAt: getSecondsTimestamp(organization.createdAt),
      updatedAt: getSecondsTimestamp(organization.updatedAt),
    },
  });

  try {
    await triggerTypedEvent(logger, topicName, message);
  } catch (_err) {
    const err = _err as Error;
    logger.error({ err, message }, 'failed to send opportunity event');
  }
};

export const notifyCandidatePreferenceChange = async ({
  con,
  logger,
  userId,
}: {
  con: DataSource;
  logger: FastifyBaseLogger;
  userId: string;
}) => {
  const data = await con
    .getRepository(UserCandidatePreference)
    .findOneBy({ userId });

  if (!data) {
    logger.warn(
      { userId },
      'Candidate preference not found for user, skipping notification',
    );
    return;
  }

  const message = new CandidatePreferenceUpdated({
    payload: {
      ...data,
      cv: new UserCV({
        ...data?.cv,
        lastModified: getSecondsTimestamp(data?.cv?.lastModified),
      }),
      updatedAt: getSecondsTimestamp(data?.updatedAt),
    },
  });

  try {
    await triggerTypedEvent(
      logger,
      'api.v1.candidate-preference-updated',
      message,
    );
  } catch (_err) {
    const err = _err as Error;
    logger.error(
      { err, message },
      'failed to send candidate preference updated event',
    );
  }
};
