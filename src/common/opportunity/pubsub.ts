import { DataSource, type EntityManager } from 'typeorm';
import { FastifyBaseLogger } from 'fastify';
import {
  CandidateAcceptedOpportunityMessage,
  CandidatePreferenceUpdated,
  MatchedCandidate,
  OpportunityMessage,
  RecruiterAcceptedCandidateMatchMessage,
  Salary,
  UserCV,
} from '@dailydotdev/schema';
import { demoCompany, triggerTypedEvent } from '../../common';
import { getSecondsTimestamp } from '../date';
import { UserCandidatePreference } from '../../entity/user/UserCandidatePreference';
import { ChangeObject } from '../../types';
import { OpportunityMatch } from '../../entity/OpportunityMatch';
import { OpportunityJob } from '../../entity/opportunities/OpportunityJob';
import { UserCandidateKeyword } from '../../entity/user/UserCandidateKeyword';
import { queryReadReplica } from '../queryReadReplica';
import { ContentPreference } from '../../entity/contentPreference/ContentPreference';
import {
  ContentPreferenceStatus,
  ContentPreferenceType,
} from '../../entity/contentPreference/types';
import { ContentPreferenceOrganization } from '../../entity/contentPreference/ContentPreferenceOrganization';

const fetchCandidateKeywords = async (
  manager: EntityManager,
  candidatePreference: UserCandidatePreference | null,
): Promise<Array<string>> => {
  if (!candidatePreference) {
    return [];
  }

  // Fetch custom keywords if enabled
  if (candidatePreference.customKeywords) {
    const customKeywords = await manager
      .getRepository(UserCandidateKeyword)
      .findBy({
        userId: candidatePreference.userId,
      });

    return customKeywords.map((k) => k.keyword);
  }

  // Otherwise fetch keywords from content preferences
  const feedKeywords = await manager
    .createQueryBuilder()
    .select(`"keywordId"`, 'keyword')
    .from(ContentPreference, 'cpk')
    .where(`cpk."feedId" = :userId`, {
      userId: candidatePreference.userId,
    })
    .andWhere('cpk.type = :contentPreferenceType', {
      contentPreferenceType: ContentPreferenceType.Keyword,
    })
    .andWhere('cpk.status != :contentPreferenceStatus', {
      contentPreferenceStatus: ContentPreferenceStatus.Blocked,
    })
    .getRawMany<{ keyword: string }>();

  return feedKeywords.map((k) => k.keyword);
};

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

  const { match, candidatePreference, keywords } = await queryReadReplica(
    con,
    async ({ queryRunner }) => {
      const [match, candidatePreference] = await Promise.all([
        queryRunner.manager.getRepository(OpportunityMatch).findOneBy({
          opportunityId: data.opportunityId,
          userId: data.userId,
        }),
        queryRunner.manager
          .getRepository(UserCandidatePreference)
          .findOneBy({ userId: data.userId }),
      ]);

      const keywords = await fetchCandidateKeywords(
        queryRunner.manager,
        candidatePreference,
      );

      return { match, candidatePreference, keywords };
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
      salaryExpectation: new Salary({
        min: candidatePreference.salaryExpectation?.min
          ? BigInt(candidatePreference.salaryExpectation.min)
          : undefined,
        period: candidatePreference.salaryExpectation?.period ?? undefined,
      }),
      cv: new UserCV({
        ...candidatePreference.cv,
        lastModified:
          getSecondsTimestamp(candidatePreference.cv.lastModified || 0) ||
          undefined,
      }),
      updatedAt: getSecondsTimestamp(candidatePreference.updatedAt),
      keywords: keywords,
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

export const notifyRecruiterCandidateMatchAccepted = async ({
  con,
  logger,
  data,
}: {
  con: DataSource;
  logger: FastifyBaseLogger;
  data: ChangeObject<OpportunityMatch> | null;
}) => {
  if (!data) {
    logger.warn(
      'No data provided for candidate opportunity match accepted notification',
    );
    return;
  }

  const match = await queryReadReplica(con, async ({ queryRunner }) => {
    return queryRunner.manager.getRepository(OpportunityMatch).findOne({
      select: ['opportunityId', 'userId'],
      where: { opportunityId: data.opportunityId, userId: data.userId },
    });
  });

  if (!match) {
    logger.warn(
      { opportunityId: data.opportunityId, userId: data.userId },
      'Opportunity match not found for recruiter accepted candidate notification',
    );
    return;
  }

  const message = new RecruiterAcceptedCandidateMatchMessage({
    opportunityId: match.opportunityId,
    userId: match.userId,
    createdAt: getSecondsTimestamp(match.createdAt),
    updatedAt: getSecondsTimestamp(match.updatedAt),
  });

  try {
    await triggerTypedEvent(
      logger,
      'api.v1.recruiter-accepted-candidate-match',
      message,
    );
  } catch (_err) {
    const err = _err as Error;
    logger.error(
      { err, message },
      'failed to send recruiter accepted candidate match event',
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

  /**
   * Demo logic: if the company is the demo company we can omit using Gondul and simply return the users from that company as matched candidates
   */
  if (organization.id === demoCompany.id) {
    const members = await con
      .getRepository(ContentPreferenceOrganization)
      .find({
        select: ['userId'],
        where: { organizationId: organization.id },
      });
    for (const { userId } of members) {
      await triggerTypedEvent(
        logger,
        'gondul.v1.candidate-opportunity-match',
        new MatchedCandidate({
          opportunityId,
          userId,
          matchScore: 0.87,
          reasoning:
            "We have noticed that you've been digging into React performance optimization and exploring payment systems lately. Your skills in TypeScript and Node.js line up directly with the core technologies this team uses. You also follow several Atlassian engineers and have shown consistent interest in project management software, which makes this role a natural fit for your trajectory.",
          reasoningShort:
            'Your skills in TypeScript and Node.js line up directly with the core technologies this team uses.',
        }),
      );
    }
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
  const { candidatePreference, keywords } = await queryReadReplica(
    con,
    async ({ queryRunner }) => {
      const candidatePreference = await queryRunner.manager
        .getRepository(UserCandidatePreference)
        .findOneBy({ userId: userId });

      const keywords = await fetchCandidateKeywords(
        queryRunner.manager,
        candidatePreference,
      );

      return { candidatePreference, keywords };
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
      salaryExpectation: new Salary({
        min: candidatePreference.salaryExpectation?.min
          ? BigInt(candidatePreference.salaryExpectation.min)
          : undefined,
        period: candidatePreference.salaryExpectation?.period ?? undefined,
      }),
      cv: new UserCV({
        ...candidatePreference?.cv,
        lastModified:
          getSecondsTimestamp(candidatePreference?.cv?.lastModified || 0) ||
          undefined,
      }),
      updatedAt:
        getSecondsTimestamp(candidatePreference?.updatedAt) || undefined,
      keywords: keywords,
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
