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
import { UserCandidateKeyword } from '../../entity/user/UserCandidateKeyword';
import { queryReadReplica } from '../queryReadReplica';

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

  const [match, candidatePreference, keywords] = await queryReadReplica(
    con,
    async ({ queryRunner }) => {
      return await Promise.all([
        queryRunner.manager.getRepository(OpportunityMatch).findOneBy({
          opportunityId: data.opportunityId,
          userId: data.userId,
        }),
        queryRunner.manager
          .getRepository(UserCandidatePreference)
          .findOneBy({ userId: data.userId }),
        queryRunner.manager.getRepository(UserCandidateKeyword).findBy({
          userId: data.userId,
        }),
      ]);
    },
  );

  if (!match) {
    logger.warn(
      { opportunityId: data.opportunityId, userId: data.userId },
      'Opportunity match not found for accepted notification',
    );
    return;
  }

  if (!candidatePreference) {
    logger.warn(
      { userId: data.userId },
      'Candidate preference not found for user accepting opportunity',
    );
    return;
  }

  const message = new CandidateAcceptedOpportunityMessage({
    opportunityId: match.opportunityId,
    userId: match.userId,
    createdAt: getSecondsTimestamp(match.createdAt),
    updatedAt: getSecondsTimestamp(match.updatedAt),
    screening: match.screening,
    candidatePreference: {
      ...candidatePreference,
      cv: new UserCV({
        ...candidatePreference.cv,
        lastModified:
          getSecondsTimestamp(candidatePreference.cv.lastModified || 0) ||
          undefined,
      }),
      updatedAt: getSecondsTimestamp(candidatePreference.updatedAt),
      keywords: keywords.map((k) => k.keyword),
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

  const [opportunity, organization, keywords] = await queryReadReplica(
    con,
    async ({ queryRunner }) => {
      const opportunity = await queryRunner.manager
        .getRepository(OpportunityJob)
        .findOneOrFail({
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

      return [opportunity, organization, keywords];
    },
  );

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
  const [candidatePreference, keywords] = await queryReadReplica(
    con,
    async ({ queryRunner }) => {
      return await Promise.all([
        queryRunner.manager
          .getRepository(UserCandidatePreference)
          .findOneBy({ userId: userId }),
        queryRunner.manager.getRepository(UserCandidateKeyword).findBy({
          userId: userId,
        }),
      ]);
    },
  );

  if (!candidatePreference) {
    logger.warn(
      { userId },
      'Candidate preference not found for user, skipping notification',
    );
    return;
  }

  const message = new CandidatePreferenceUpdated({
    payload: {
      ...candidatePreference,
      cv: new UserCV({
        ...candidatePreference?.cv,
        lastModified:
          getSecondsTimestamp(candidatePreference?.cv?.lastModified || 0) ||
          undefined,
      }),
      updatedAt:
        getSecondsTimestamp(candidatePreference?.updatedAt) || undefined,
      keywords: keywords.map((k) => k.keyword),
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
