import { DataSource } from 'typeorm';
import { FastifyBaseLogger } from 'fastify';
import { triggerTypedEvent } from '../typedPubsub';
import { CandidateAcceptedOpportunityMessage } from '@dailydotdev/schema';
import { getSecondsTimestamp } from '../date';
import { UserCandidatePreference } from '../../entity/user/UserCandidatePreference';
import { ChangeObject } from '../../types';
import { OpportunityMatch } from '../../entity/OpportunityMatch';

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
