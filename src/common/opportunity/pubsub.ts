import { DataSource } from 'typeorm';
import { FastifyBaseLogger } from 'fastify';
import {
  CandidateAcceptedOpportunityMessage,
  OpportunityMessage,
  OpportunityType,
} from '@dailydotdev/schema';
import { triggerTypedEvent } from '../../common';
import { getSecondsTimestamp } from '../date';
import { UserCandidatePreference } from '../../entity/user/UserCandidatePreference';
import { ChangeObject } from '../../types';
import { OpportunityMatch } from '../../entity/OpportunityMatch';
import { OpportunityJob } from '../../entity/opportunities/OpportunityJob';
import { stringArrayToListValue } from '../protobuf';

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

  const organization = await opportunity.organization;

  const keywords = (await opportunity.keywords).map((k) => k.keyword);

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
      id: opportunity.id,
      type: OpportunityType.JOB,
      state: opportunity.state,
      title: opportunity.title,
      tldr: opportunity.tldr,
      content: opportunity.content,
      meta: opportunity.meta,
      keywords: keywords,
    },
    organization: {
      id: organization.id,
      name: organization.name,
      description: organization.description,
      perks: organization.perks,
      location: organization.location,
      size: organization.size,
      category: organization.category,
      stage: organization.stage,
    },
  });

  try {
    await triggerTypedEvent(logger, topicName, message);
  } catch (_err) {
    const err = _err as Error;
    logger.error({ err, message }, 'failed to send opportunity event');
  }

  logger.info(
    { opportunityId: opportunity.id, topicName },
    'sent opportunity event',
  );
};
