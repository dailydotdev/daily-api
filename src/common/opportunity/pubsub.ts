import { DataSource, type EntityManager } from 'typeorm';
import { FastifyBaseLogger } from 'fastify';
import {
  CandidateAcceptedOpportunityMessage,
  CandidatePreferenceUpdated,
  CandidateRejectedOpportunityMessage,
  MatchedCandidate,
  OpportunityMessage,
  RecruiterAcceptedCandidateMatchMessage,
  Salary,
  UserCV,
  Location,
} from '@dailydotdev/schema';
import {
  debeziumTimeToDate,
  demoCompany,
  triggerTypedEvent,
  uniqueifyArray,
} from '../../common';
import { getSecondsTimestamp } from '../date';
import { UserCandidatePreference } from '../../entity/user/UserCandidatePreference';
import { ChangeObject, continentMap } from '../../types';
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
import { OpportunityUser } from '../../entity/opportunities/user';
import { OpportunityUserType } from '../../entity/opportunities/types';

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

  const { match, candidatePreference, keywords, locationData } =
    await con.transaction(async (manager) => {
      const [match, candidatePreference] = await Promise.all([
        manager.getRepository(OpportunityMatch).findOneBy({
          opportunityId: data.opportunityId,
          userId: data.userId,
        }),
        manager
          .getRepository(UserCandidatePreference)
          .findOne({ where: { userId: data.userId }, relations: ['location'] }),
      ]);

      const keywords = await fetchCandidateKeywords(
        manager,
        candidatePreference,
      );

      const locationData = await candidatePreference?.location;

      return { match, candidatePreference, keywords, locationData };
    });

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

  const cvLastModifiedDate =
    typeof candidatePreference.cv.lastModified === 'string'
      ? new Date(candidatePreference.cv.lastModified)
      : candidatePreference.cv.lastModified;

  // Prioritize relational location over customLocation
  const locationArray = locationData
    ? [
        {
          ...locationData,
          // Convert null to undefined for protobuf compatibility
          subdivision: locationData.subdivision ?? undefined,
          city: locationData.city ?? undefined,
          externalId: locationData.externalId ?? undefined,
        },
      ]
    : candidatePreference.customLocation || [];

  const message = new CandidateAcceptedOpportunityMessage({
    opportunityId: match.opportunityId,
    userId: match.userId,
    createdAt: getSecondsTimestamp(match.createdAt),
    updatedAt: getSecondsTimestamp(match.updatedAt),
    screening: match.screening,
    candidatePreference: {
      ...candidatePreference,
      location: locationArray,
      salaryExpectation: new Salary({
        min: candidatePreference.salaryExpectation?.min
          ? BigInt(candidatePreference.salaryExpectation.min)
          : undefined,
        period: candidatePreference.salaryExpectation?.period ?? undefined,
      }),
      cv: new UserCV({
        ...candidatePreference.cv,
        lastModified: getSecondsTimestamp(cvLastModifiedDate || 0) || undefined,
      }),
      updatedAt: getSecondsTimestamp(candidatePreference.updatedAt),
      keywords: keywords,
      cvParsedMarkdown: candidatePreference.cvParsedMarkdown || undefined,
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

  /**
   * TODO: For now this will simply fetch the first recruiter.
   * Ideally this should maintain which recruiter accepted the match
   */
  const [match, opportunityUser] = await queryReadReplica(
    con,
    ({ queryRunner }) =>
      Promise.all([
        queryRunner.manager.getRepository(OpportunityMatch).findOne({
          where: { opportunityId: data.opportunityId, userId: data.userId },
        }),
        queryRunner.manager.getRepository(OpportunityUser).findOne({
          select: ['userId', 'opportunityId', 'type'],
          relations: ['user'],
          where: {
            opportunityId: data.opportunityId,
            type: OpportunityUserType.Recruiter,
          },
        }),
      ]),
  );

  const recruiter = await opportunityUser?.user;

  if (!match || !recruiter) {
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
    recruiter: {
      name: recruiter.name,
      role: recruiter?.title,
      bio: recruiter?.bio,
    },
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

export const notifyRecruiterCandidateMatchRejected = async ({
  logger,
  data,
}: {
  logger: FastifyBaseLogger;
  data: ChangeObject<OpportunityMatch>;
}) => {
  const message = new CandidateRejectedOpportunityMessage({
    opportunityId: data.opportunityId,
    userId: data.userId,
    createdAt: getSecondsTimestamp(debeziumTimeToDate(data.createdAt)),
    updatedAt: getSecondsTimestamp(debeziumTimeToDate(data.updatedAt)),
  });

  await triggerTypedEvent(
    logger,
    'api.v1.recruiter-rejected-candidate-match',
    message,
  );
};

export const notifyCandidateOpportunityMatchRejected = async ({
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
      select: ['opportunityId', 'userId', 'createdAt', 'updatedAt'],
      where: { opportunityId: data.opportunityId, userId: data.userId },
    });
  });

  if (!match) {
    logger.warn(
      { opportunityId: data.opportunityId, userId: data.userId },
      'Opportunity match not found for candidate rejected match notification',
    );
    return;
  }

  const message = new CandidateRejectedOpportunityMessage({
    opportunityId: match.opportunityId,
    userId: match.userId,
    createdAt: getSecondsTimestamp(match.createdAt),
    updatedAt: getSecondsTimestamp(match.updatedAt),
  });

  try {
    await triggerTypedEvent(
      logger,
      'api.v1.candidate-rejected-opportunity',
      message,
    );
  } catch (_err) {
    const err = _err as Error;
    logger.error(
      { err, message },
      'failed to send candidate rejected match event',
    );
  }
};

export const notifyJobOpportunity = async ({
  con,
  logger,
  opportunityId,
}: {
  con: DataSource;
  logger: FastifyBaseLogger;
  opportunityId: string;
}) => {
  const [opportunity, organization, keywords, users, locations] =
    await queryReadReplica(con, async ({ queryRunner }) => {
      const opportunity = await queryRunner.manager
        .getRepository(OpportunityJob)
        .findOneOrFail({
          where: { id: opportunityId },
          relations: {
            organization: true,
            keywords: true,
            users: true,
            locations: true,
          },
        });

      const [organization, keywords, users, locations] = await Promise.all([
        opportunity.organization,
        opportunity.keywords,
        opportunity.users,
        opportunity.locations,
      ]);

      return [opportunity, organization, keywords, users, locations];
    });

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

  const organizationMembers = await queryReadReplica(
    con,
    async ({ queryRunner }) => {
      return await queryRunner.manager
        .getRepository(ContentPreferenceOrganization)
        .find({
          select: ['userId'],
          where: { organizationId: organization.id },
        });
    },
  );

  /**
   * Demo logic: if the company is the demo company we can omit using Gondul and simply return the users from that company as matched candidates
   */
  if (organization.id === demoCompany.id) {
    for (const { userId } of organizationMembers) {
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

  const excludedUserIds = uniqueifyArray([
    ...organizationMembers.map((m) => m.userId),
    ...users.map((u) => u.userId),
  ]);

  // Check if the location country is a continent and return only continent code
  const locationData = locations?.[0];
  const datasetLocation = locationData ? await locationData.location : null;
  const locationCountry = datasetLocation?.country;
  const continentCode = locationCountry ? continentMap[locationCountry] : null;

  const locationPayload = continentCode
    ? { continent: continentCode }
    : {
        ...datasetLocation,
        // Convert null values to undefined for protobuf compatibility
        subdivision: datasetLocation?.subdivision ?? undefined,
        city: datasetLocation?.city ?? undefined,
        type: locationData?.type,
      };

  const organizationLocation = await organization.location;

  const message = new OpportunityMessage({
    opportunity: {
      ...opportunity,
      createdAt: getSecondsTimestamp(opportunity.createdAt),
      updatedAt: getSecondsTimestamp(opportunity.updatedAt),
      keywords: keywords.map((k) => k.keyword),
      location: [locationPayload],
    },
    organization: {
      ...organization,
      createdAt: getSecondsTimestamp(organization.createdAt),
      updatedAt: getSecondsTimestamp(organization.updatedAt),
      location: new Location({
        country: organizationLocation?.country,
        city: organizationLocation?.city || undefined,
        subdivision: organizationLocation?.subdivision || undefined,
        iso2: organizationLocation?.iso2,
      }),
    },
    excludedUserIds,
  });

  try {
    await triggerTypedEvent(logger, 'api.v1.opportunity-added', message);
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
  const { candidatePreference, keywords, locationData } = await con.transaction(
    async (manager) => {
      const candidatePreference = await manager
        .getRepository(UserCandidatePreference)
        .findOne({ where: { userId: userId }, relations: ['location'] });

      const keywords = await fetchCandidateKeywords(
        manager,
        candidatePreference,
      );

      const locationData = await candidatePreference?.location;

      return { candidatePreference, keywords, locationData };
    },
  );

  if (!candidatePreference) {
    logger.warn(
      { userId },
      'Candidate preference not found for user, skipping notification',
    );
    return;
  }

  const cvLastModifiedDate =
    typeof candidatePreference?.cv?.lastModified === 'string'
      ? new Date(candidatePreference.cv.lastModified)
      : candidatePreference?.cv?.lastModified;

  // Prioritize relational location over customLocation
  const locationArray = locationData
    ? [
        {
          ...locationData,
          // Convert null to undefined for protobuf compatibility
          subdivision: locationData.subdivision ?? undefined,
          city: locationData.city ?? undefined,
          externalId: locationData.externalId ?? undefined,
        },
      ]
    : candidatePreference.customLocation || [];

  const message = new CandidatePreferenceUpdated({
    payload: {
      ...candidatePreference,
      location: locationArray,
      salaryExpectation: new Salary({
        min: candidatePreference.salaryExpectation?.min
          ? BigInt(candidatePreference.salaryExpectation.min)
          : undefined,
        period: candidatePreference.salaryExpectation?.period ?? undefined,
      }),
      cv: new UserCV({
        ...candidatePreference?.cv,
        lastModified: getSecondsTimestamp(cvLastModifiedDate || 0) || undefined,
      }),
      updatedAt:
        getSecondsTimestamp(candidatePreference?.updatedAt) || undefined,
      keywords: keywords,
      cvParsedMarkdown: candidatePreference.cvParsedMarkdown || undefined,
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
