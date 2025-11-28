import z from 'zod';
import { IResolvers } from '@graphql-tools/utils';
// @ts-expect-error - no types
import { FileUpload } from 'graphql-upload/GraphQLUpload.js';
import { traceResolvers } from './trace';
import { AuthContext, BaseContext, type Context } from '../Context';
import graphorm from '../graphorm';
import {
  Opportunity,
  BrokkrParseRequest,
  OpportunityContent,
  OpportunityState,
  ScreeningQuestionsRequest,
} from '@dailydotdev/schema';
import { OpportunityMatch } from '../entity/OpportunityMatch';
import {
  getBufferFromStream,
  toGQLEnum,
  updateFlagsStatement,
} from '../common';
import {
  OpportunityMatchStatus,
  OpportunityUserType,
} from '../entity/opportunities/types';
import { UserCandidatePreference } from '../entity/user/UserCandidatePreference';
import type { GQLEmptyResponse } from './common';
import {
  candidatePreferenceSchema,
  uploadEmploymentAgreementSchema,
  userCandidateToggleKeywordSchema,
} from '../common/schema/userCandidate';
import { Alerts } from '../entity';
import {
  opportunityScreeningAnswersSchema,
  opportunityFeedbackAnswersSchema,
} from '../common/schema/opportunityMatch';
import { OpportunityJob } from '../entity/opportunities/OpportunityJob';
import { OpportunityUserRecruiter } from '../entity/opportunities/user/OpportunityUserRecruiter';
import { ForbiddenError, ValidationError } from 'apollo-server-errors';
import { ConflictError, NotFoundError } from '../errors';
import { UserCandidateKeyword } from '../entity/user/UserCandidateKeyword';
import { User } from '../entity/user/User';
import {
  EMPLOYMENT_AGREEMENT_BUCKET_NAME,
  RESUME_BUCKET_NAME,
} from '../config';
import {
  deleteEmploymentAgreementByUserId,
  deleteFileFromBucket,
  generateResumeSignedUrl,
  uploadEmploymentAgreementFromBuffer,
  uploadResumeFromBuffer,
} from '../common/googleCloud';
import { uploadOrganizationImage } from '../common/cloudinary';
import {
  opportunityCreateParseSchema,
  opportunityEditSchema,
  opportunityStateLiveSchema,
  opportunityUpdateStateSchema,
  parseOpportunitySchema,
} from '../common/schema/opportunities';
import { OpportunityKeyword } from '../entity/OpportunityKeyword';
import {
  ensureOpportunityPermissions,
  OpportunityPermissions,
} from '../common/opportunity/accessControl';
import { markdown } from '../common/markdown';
import { QuestionScreening } from '../entity/questions/QuestionScreening';
import { In, Not, type DeepPartial } from 'typeorm';
import { Organization } from '../entity/Organization';
import {
  OrganizationLinkType,
  SocialMediaType,
} from '../common/schema/organizations';
import { getGondulClient } from '../common/gondul';
import { createOpportunityPrompt } from '../common/opportunity/prompt';
import { queryPaginatedByDate } from '../common/datePageGenerator';
import { ConnectionArguments } from 'graphql-relay';
import { ProfileResponse, snotraClient } from '../integrations/snotra';
import { fileTypeFromBuffer } from 'file-type';
import { acceptedOpportunityFileTypes } from '../types';
import { getBrokkrClient } from '../common/brokkr';
import { garmScraperService } from '../common/scraper';

export interface GQLOpportunity
  extends Pick<
    Opportunity,
    'id' | 'type' | 'state' | 'title' | 'tldr' | 'content' | 'keywords'
  > {
  createdAt: Date;
  updatedAt: Date;
}

export interface GQLOpportunityMatch
  extends Pick<
    OpportunityMatch,
    'status' | 'description' | 'userId' | 'opportunityId'
  > {
  createdAt: Date;
  updatedAt: Date;
}

export interface GQLUserCandidatePreference
  extends Omit<
    UserCandidatePreference,
    'userId' | 'user' | 'updatedAt' | 'cvParsed'
  > {
  keywords?: Array<{ keyword: string }>;
}

export type GQLOpportunityScreeningQuestion = Pick<
  QuestionScreening,
  'id' | 'title' | 'placeholder' | 'opportunityId'
> & {
  order: number;
};

export const typeDefs = /* GraphQL */ `
  ${toGQLEnum(OpportunityMatchStatus, 'OpportunityMatchStatus')}
  ${toGQLEnum(OrganizationLinkType, 'OrganizationLinkType')}
  ${toGQLEnum(SocialMediaType, 'SocialMediaType')}

  type OpportunityContentBlock {
    content: String
    html: String!
  }

  type OpportunityContent {
    overview: OpportunityContentBlock
    responsibilities: OpportunityContentBlock
    requirements: OpportunityContentBlock
    whatYoullDo: OpportunityContentBlock
    interviewProcess: OpportunityContentBlock
  }

  type Salary {
    min: Float
    max: Float
    currency: String
    period: ProtoEnumValue
  }

  type SalaryExpectation {
    min: Float
    period: ProtoEnumValue
  }

  type Location {
    city: String
    country: String
    subdivision: String
    continent: String
    type: ProtoEnumValue
  }

  type OpportunityMeta {
    employmentType: ProtoEnumValue
    teamSize: Int
    salary: Salary
    seniorityLevel: ProtoEnumValue
    roleType: Float
    equity: Boolean
  }

  type OpportunityKeyword {
    keyword: String!
  }

  type OpportunityScreeningQuestion {
    id: ID!
    title: String!
    order: Int!
    placeholder: String
    opportunityId: ID!
  }

  type OpportunityFeedbackQuestion {
    id: ID!
    title: String!
    order: Int!
    placeholder: String
    opportunityId: ID!
  }

  type OpportunityEdge {
    node: Opportunity!

    """
    Used in \`before\` and \`after\` args
    """
    cursor: String!
  }

  type OpportunityConnection {
    pageInfo: PageInfo!
    edges: [OpportunityEdge!]!
  }

  type Opportunity {
    id: ID!
    type: ProtoEnumValue!
    state: ProtoEnumValue!
    title: String!
    tldr: String
    content: OpportunityContent!
    meta: OpportunityMeta!
    location: [Location]!
    organization: Organization!
    recruiters: [User!]!
    keywords: [OpportunityKeyword]!
    questions: [OpportunityScreeningQuestion]!
    feedbackQuestions: [OpportunityFeedbackQuestion]!
  }

  type OpportunityMatchDescription {
    reasoning: String!
  }

  type ScreeningAnswer {
    screening: String!
    answer: String!
  }

  type ApplicationRank {
    score: Float
    description: String
    warmIntro: String
  }

  type EngagementProfile {
    profileText: String!
  }

  type OpportunityMatch {
    status: OpportunityMatchStatus!
    description: OpportunityMatchDescription!
    userId: String!
    opportunityId: String!
    createdAt: DateTime!
    updatedAt: DateTime!
    user: User!
    opportunity: Opportunity
    candidatePreferences: UserCandidatePreference
    screening: [ScreeningAnswer!]!
    feedback: [ScreeningAnswer!]!
    applicationRank: ApplicationRank!
    engagementProfile: EngagementProfile
  }

  type OpportunityMatchEdge {
    node: OpportunityMatch!

    """
    Used in \`before\` and \`after\` args
    """
    cursor: String!
  }

  type OpportunityMatchConnection {
    pageInfo: PageInfo!
    edges: [OpportunityMatchEdge!]!
  }

  type GCSBlob {
    blob: String
    fileName: String
    contentType: String
    lastModified: DateTime
    signedUrl: String
  }

  type UserCandidateKeyword {
    keyword: String!
  }

  type UserCandidatePreference {
    status: ProtoEnumValue!
    cv: GCSBlob
    employmentAgreement: GCSBlob
    role: String
    roleType: Float
    employmentType: [ProtoEnumValue]!
    salaryExpectation: SalaryExpectation
    location: [Location]!
    locationType: [ProtoEnumValue]!
    companyStage: [ProtoEnumValue]!
    companySize: [ProtoEnumValue]!
    customKeywords: Boolean
    keywords: [UserCandidateKeyword!]!
  }

  extend type Query {
    """
    Get the public information about a Opportunity listing
    """
    opportunityById(
      """
      Id of Opportunity
      """
      id: ID!
    ): Opportunity
    """
    Gets the status and description from the Opportunity match
    """
    getOpportunityMatch(
      """
      Id of the Opportunity
      """
      id: ID!
    ): OpportunityMatch @auth

    """
    Returns the authenticated candidate's saved preferences
    """
    getCandidatePreferences: UserCandidatePreference @auth

    """
    Get all opportunities filtered by state (defaults to LIVE)
    """
    opportunities(
      """
      State of opportunities to fetch (defaults to LIVE)
      """
      state: ProtoEnumValue
      """
      Paginate after opaque cursor
      """
      after: String
      """
      Paginate first
      """
      first: Int
    ): OpportunityConnection! @auth

    """
    Get all opportunity matches for a specific opportunity (includes only candidate_accepted, recruiter_accepted, and recruiter_rejected statuses)
    """
    opportunityMatches(
      """
      Id of the Opportunity
      """
      opportunityId: ID!
      """
      Paginate after opaque cursor
      """
      after: String
      """
      Paginate first
      """
      first: Int
    ): OpportunityMatchConnection! @auth

    """
    Get all opportunity matches for the authenticated user
    """
    userOpportunityMatches(
      """
      Paginate after opaque cursor
      """
      after: String
      """
      Paginate first
      """
      first: Int
    ): OpportunityMatchConnection! @auth
  }

  input SalaryExpectationInput {
    min: Float
    period: ProtoEnumValue
  }

  input LocationInput {
    city: String
    country: String
    subdivision: String
    continent: String
    type: ProtoEnumValue
  }

  input OpportunityScreeningAnswerInput {
    questionId: ID!
    answer: String!
  }

  input SalaryInput {
    min: Float
    max: Float
    period: ProtoEnumValue
  }

  input OpportunityMetaInput {
    employmentType: ProtoEnumValue
    teamSize: Int
    salary: SalaryInput
    seniorityLevel: ProtoEnumValue
    roleType: Float
  }

  input OpportunityKeywordInput {
    keyword: String!
  }

  input OpportunityContentBlockInput {
    content: String
  }

  input OpportunityContentInput {
    overview: OpportunityContentBlockInput
    responsibilities: OpportunityContentBlockInput
    requirements: OpportunityContentBlockInput
    whatYoullDo: OpportunityContentBlockInput
    interviewProcess: OpportunityContentBlockInput
  }

  input OpportunityScreeningQuestionInput {
    id: ID
    title: String!
    placeholder: String
  }

  input OrganizationLinkInput {
    type: OrganizationLinkType!
    socialType: SocialMediaType
    title: String
    link: String!
  }

  input OrganizationEditInput {
    website: String
    description: String
    perks: [String!]
    founded: Int
    location: String
    category: String
    size: Int
    stage: Int
    links: [OrganizationLinkInput!]
  }

  input RecruiterInput {
    userId: ID!
    title: String
    bio: String
  }

  input OpportunityEditInput {
    title: String
    tldr: String
    meta: OpportunityMetaInput
    location: [LocationInput]
    keywords: [OpportunityKeywordInput]
    content: OpportunityContentInput
    questions: [OpportunityScreeningQuestionInput!]
    organization: OrganizationEditInput
    recruiter: RecruiterInput
  }

  input ParseOpportunityInput {
    """
    PDF, Word file to parse
    """
    file: Upload

    """
    URL to scrape and parse
    """
    url: String
  }

  extend type Mutation {
    """
    Updates the authenticated candidate's saved preferences
    """
    updateCandidatePreferences(
      status: ProtoEnumValue
      role: String
      roleType: Float
      employmentType: [ProtoEnumValue]
      salaryExpectation: SalaryExpectationInput
      location: [LocationInput]
      locationType: [ProtoEnumValue]
      customKeywords: Boolean
    ): EmptyResponse @auth

    saveOpportunityScreeningAnswers(
      """
      Id of the Opportunity
      """
      id: ID!

      answers: [OpportunityScreeningAnswerInput!]!
    ): EmptyResponse @auth

    saveOpportunityFeedbackAnswers(
      """
      Id of the Opportunity
      """
      id: ID!

      answers: [OpportunityScreeningAnswerInput!]!
    ): EmptyResponse @auth

    acceptOpportunityMatch(
      """
      Id of the Opportunity
      """
      id: ID!
    ): EmptyResponse @auth

    rejectOpportunityMatch(
      """
      Id of the Opportunity
      """
      id: ID!
    ): EmptyResponse @auth

    recruiterAcceptOpportunityMatch(
      """
      Id of the Opportunity
      """
      opportunityId: ID!
      """
      Id of the candidate user to accept
      """
      candidateUserId: ID!
    ): EmptyResponse @auth

    recruiterRejectOpportunityMatch(
      """
      Id of the Opportunity
      """
      opportunityId: ID!
      """
      Id of the candidate user to reject
      """
      candidateUserId: ID!
    ): EmptyResponse @auth

    candidateAddKeywords(
      """
      Keywords to add to candidate profile
      """
      keywords: [String!]!
    ): EmptyResponse @auth

    candidateRemoveKeywords(
      """
      Keywords to remove from candidate profile
      """
      keywords: [String!]!
    ): EmptyResponse @auth

    uploadEmploymentAgreement(
      """
      Asset to upload
      """
      file: Upload!
    ): EmptyResponse @auth @rateLimit(limit: 5, duration: 60)

    clearEmploymentAgreement: EmptyResponse
      @auth
      @rateLimit(limit: 5, duration: 60)

    editOpportunity(
      """
      Id of the Opportunity
      """
      id: ID!

      """
      Opportunity data to update
      """
      payload: OpportunityEditInput!

      """
      Organization image to upload
      """
      organizationImage: Upload
    ): Opportunity! @auth

    """
    Clear the organization image for an opportunity
    """
    clearOrganizationImage(
      """
      Id of the Opportunity
      """
      id: ID!
    ): EmptyResponse @auth

    recommendOpportunityScreeningQuestions(
      """
      Id of the Opportunity
      """
      id: ID!
    ): [OpportunityScreeningQuestion!]! @auth

    updateOpportunityState(
      """
      Id of the Opportunity
      """
      id: ID!

      state: ProtoEnumValue!
    ): EmptyResponse @auth

    """
    Parse an opportunity from a URL or file upload
    """
    parseOpportunity(payload: ParseOpportunityInput!): Opportunity!
      @rateLimit(limit: 5, duration: 3600)
  }
`;

/**
 * Shared logic for updating an opportunity match status by a recruiter
 * Validates recruiter permissions, match exists, is candidate_accepted, and opportunity is live
 */
async function updateRecruiterMatchStatus(
  opportunityId: string,
  candidateUserId: string,
  targetStatus: OpportunityMatchStatus,
  ctx: AuthContext,
): Promise<void> {
  // Verify the logged-in user is a recruiter for this opportunity
  await ensureOpportunityPermissions({
    con: ctx.con.manager,
    userId: ctx.userId,
    opportunityId,
    permission: OpportunityPermissions.UpdateState,
    isTeamMember: ctx.isTeamMember,
  });

  const match = await ctx.con.getRepository(OpportunityMatch).findOne({
    where: {
      opportunityId,
      userId: candidateUserId,
    },
    relations: {
      opportunity: true,
    },
  });

  if (!match) {
    ctx.log.error(
      { opportunityId, candidateUserId },
      'No match found for candidate',
    );
    throw new ForbiddenError('Access denied! No match found');
  }

  if (match.status !== OpportunityMatchStatus.CandidateAccepted) {
    ctx.log.error(
      { opportunityId, candidateUserId, status: match.status },
      'Match is not candidate accepted',
    );
    throw new ForbiddenError(
      `Access denied! Match must be in candidate_accepted status`,
    );
  }

  await ctx.con.getRepository(OpportunityMatch).update(
    {
      opportunityId,
      userId: candidateUserId,
    },
    {
      status: targetStatus,
    },
  );
}

/**
 * Shared logic for updating an opportunity match status for a candidate
 * Validates the match exists, is pending, and the opportunity is live
 */
async function updateCandidateMatchStatus(
  opportunityId: string,
  userId: string,
  targetStatus: OpportunityMatchStatus,
  ctx: AuthContext,
): Promise<void> {
  const match = await ctx.con.getRepository(OpportunityMatch).findOne({
    where: {
      opportunityId,
      userId,
    },
    relations: {
      opportunity: true,
    },
  });

  if (!match) {
    ctx.log.error({ opportunityId, userId }, 'No match found for opportunity');
    throw new ForbiddenError('Access denied! No match found');
  }

  if (match.status !== OpportunityMatchStatus.Pending) {
    ctx.log.error(
      { opportunityId, userId, status: match.status },
      'Match is not pending',
    );
    throw new ForbiddenError(`Access denied! Match is not pending`);
  }

  await ctx.con.transaction(async (entityManager) => {
    await entityManager.getRepository(OpportunityMatch).update(
      {
        opportunityId,
        userId,
      },
      {
        status: targetStatus,
      },
    );

    await entityManager.getRepository(Alerts).update(
      {
        userId,
        opportunityId,
      },
      {
        opportunityId: null,
        flags: updateFlagsStatement<Alerts>({ hasSeenOpportunity: true }),
      },
    );
  });
}

export const resolvers: IResolvers<unknown, BaseContext> = traceResolvers<
  unknown,
  BaseContext
>({
  Query: {
    opportunityById: async (
      _,
      { id }: { id: string },
      ctx: Context,
      info,
    ): Promise<GQLOpportunity> => {
      const opportunity = await graphorm.queryOneOrFail<GQLOpportunity>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder.where({ id });

          builder.queryBuilder.addSelect(`${builder.alias}.state`, 'state');

          return builder;
        },
      );

      if (opportunity.state !== OpportunityState.LIVE) {
        if (!ctx.userId) {
          throw new NotFoundError('Not found!');
        }

        await ensureOpportunityPermissions({
          con: ctx.con.manager,
          userId: ctx.userId,
          opportunityId: id,
          permission: OpportunityPermissions.ViewDraft,
          isTeamMember: ctx.isTeamMember,
        });
      }

      return opportunity;
    },
    getOpportunityMatch: async (
      _,
      { id }: { id: string },
      ctx: AuthContext,
      info,
    ): Promise<GQLOpportunityMatch> => {
      return await graphorm.queryOneOrFail<GQLOpportunityMatch>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder
            .where({ opportunityId: id })
            .andWhere({ userId: ctx.userId });
          return builder;
        },
      );
    },
    getCandidatePreferences: async (
      _,
      __,
      ctx: AuthContext,
      info,
    ): Promise<GQLUserCandidatePreference> => {
      const preferences = await graphorm.queryOne<GQLUserCandidatePreference>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder.where({ userId: ctx.userId });
          return builder;
        },
      );

      if (preferences) {
        return preferences;
      }

      return {
        ...new UserCandidatePreference(),
        keywords: [],
      };
    },
    opportunities: async (
      _,
      args: ConnectionArguments & { state?: number },
      ctx: Context,
      info,
    ) => {
      // Default to LIVE opportunities if no state is provided
      const opportunityState = args.state ?? OpportunityState.LIVE;

      if (!ctx.userId) {
        throw new NotFoundError('Not found!');
      }

      return await queryPaginatedByDate<
        GQLOpportunity,
        'createdAt',
        typeof args
      >(
        ctx,
        info,
        args,
        { key: 'createdAt', maxSize: 50 },
        {
          queryBuilder: (builder) => {
            builder.queryBuilder.where({ state: opportunityState });

            if (!ctx.isTeamMember) {
              builder.queryBuilder
                .innerJoin(
                  'opportunity_user',
                  'ou',
                  `ou.opportunityId = ${builder.alias}.id`,
                )
                .andWhere('ou.userId = :userId', { userId: ctx.userId })
                .andWhere('ou.type = :type', {
                  type: OpportunityUserType.Recruiter,
                });
            }

            return builder;
          },
          orderByKey: 'DESC',
          readReplica: true,
        },
      );
    },
    opportunityMatches: async (
      _,
      args: ConnectionArguments & { opportunityId: string },
      ctx: AuthContext,
      info,
    ) => {
      if (!ctx.userId) {
        throw new NotFoundError('Not found!');
      }

      // First verify the user has access to this opportunity
      await ensureOpportunityPermissions({
        con: ctx.con.manager,
        userId: ctx.userId,
        opportunityId: args.opportunityId,
        permission: OpportunityPermissions.UpdateState,
        isTeamMember: ctx.isTeamMember,
      });

      return await queryPaginatedByDate<
        GQLOpportunityMatch,
        'updatedAt',
        typeof args
      >(
        ctx,
        info,
        args,
        { key: 'updatedAt', maxSize: 50 },
        {
          queryBuilder: (builder) => {
            builder.queryBuilder
              .where({ opportunityId: args.opportunityId })
              .andWhere(`${builder.alias}.status IN (:...statuses)`, {
                statuses: [
                  OpportunityMatchStatus.CandidateAccepted,
                  OpportunityMatchStatus.RecruiterAccepted,
                  OpportunityMatchStatus.RecruiterRejected,
                ],
              })
              // Order by candidate_accepted status first (priority 0), then others (priority 1)
              // Then by updatedAt ascending (oldest first) within each group
              .addOrderBy(
                `CASE WHEN ${builder.alias}.status = :candidateAcceptedStatus THEN 0 ELSE 1 END`,
                'ASC',
              )
              .addOrderBy(`${builder.alias}.updatedAt`, 'ASC')
              .setParameter(
                'candidateAcceptedStatus',
                OpportunityMatchStatus.CandidateAccepted,
              );

            return builder;
          },
          orderByKey: 'ASC',
          readReplica: true,
        },
      );
    },
    userOpportunityMatches: async (
      _,
      args: ConnectionArguments,
      ctx: AuthContext,
      info,
    ) =>
      await queryPaginatedByDate<GQLOpportunityMatch, 'updatedAt', typeof args>(
        ctx,
        info,
        args,
        { key: 'updatedAt', maxSize: 50 },
        {
          queryBuilder: (builder) => {
            builder.queryBuilder.where({ userId: ctx.userId });

            return builder;
          },
          orderByKey: 'DESC',
          readReplica: true,
        },
      ),
  },
  Mutation: {
    updateCandidatePreferences: async (
      _,
      payload: z.infer<typeof candidatePreferenceSchema>,
      { userId, con }: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const preferences = candidatePreferenceSchema.safeParse(payload);

      if (preferences.error) {
        throw preferences.error;
      }

      await con.getRepository(UserCandidatePreference).upsert(
        {
          userId,
          ...preferences.data,
        },
        {
          conflictPaths: ['userId'],
          skipUpdateIfNoValuesChanged: true,
        },
      );

      return { _: true };
    },
    saveOpportunityScreeningAnswers: async (
      _,
      payload: z.infer<typeof opportunityScreeningAnswersSchema>,
      { userId, con, log }: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const safePayload = opportunityScreeningAnswersSchema.safeParse(payload);
      if (safePayload.error) {
        throw safePayload.error;
      }

      const opportunityId = safePayload.data.id;
      const answers = safePayload.data.answers;

      const [match, opportunity] = await Promise.all([
        con.getRepository(OpportunityMatch).findOneBy({
          opportunityId,
          userId,
          status: OpportunityMatchStatus.Pending,
        }),
        con.getRepository(OpportunityJob).findOneOrFail({
          where: { id: opportunityId, state: OpportunityState.LIVE },
          relations: {
            questions: true,
          },
        }),
      ]);

      if (!match) {
        throw new ForbiddenError(`Access denied! Match is not pending`);
      }

      const questions = await opportunity.questions;

      // Check if the number of answers matches the number of questions
      if (answers.length !== questions.length) {
        log.error(
          { answers, questions, opportunityId },
          'Answer count mismatch',
        );
        throw new ConflictError(
          `Number of answers (${answers.length}) does not match the required questions`,
        );
      }

      // Map answers to questions, throw if question not found
      const screening = answers.map((answer) => {
        const question = questions.find((q) => q.id === answer.questionId);
        if (!question) {
          log.error(
            { answer, questions, opportunityId },
            'Question not found for opportunity',
          );
          throw new ConflictError(
            `Question ${answer.questionId} not found for opportunity`,
          );
        }

        return {
          screening: question.title,
          answer: answer.answer,
        };
      });

      await con.getRepository(OpportunityMatch).upsert(
        {
          opportunityId,
          userId,
          screening,
        },
        {
          conflictPaths: ['opportunityId', 'userId'],
          skipUpdateIfNoValuesChanged: true,
        },
      );
      return { _: true };
    },
    saveOpportunityFeedbackAnswers: async (
      _,
      payload: z.infer<typeof opportunityFeedbackAnswersSchema>,
      { userId, con, log }: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const safePayload = opportunityFeedbackAnswersSchema.safeParse(payload);
      if (safePayload.error) {
        throw safePayload.error;
      }

      const opportunityId = safePayload.data.id;
      const answers = safePayload.data.answers;

      const [match, opportunity] = await Promise.all([
        con.getRepository(OpportunityMatch).findOneBy({
          opportunityId,
          userId,
        }),
        con.getRepository(OpportunityJob).findOneOrFail({
          where: { id: opportunityId },
          relations: {
            feedbackQuestions: true,
          },
        }),
      ]);

      if (!match) {
        throw new ForbiddenError(`Access denied! No match found`);
      }

      const questions = await opportunity.feedbackQuestions;

      // Feedback questions are optional, so validate only that provided questionIds exist
      const feedback = answers.map((answer) => {
        const question = questions.find((q) => q.id === answer.questionId);
        if (!question) {
          log.error(
            { answer, questions, opportunityId },
            'Question not found for opportunity',
          );
          throw new ConflictError(
            `Question ${answer.questionId} not found for opportunity`,
          );
        }

        return {
          screening: question.title,
          answer: answer.answer,
        };
      });

      await con.getRepository(OpportunityMatch).upsert(
        {
          opportunityId,
          userId,
          feedback,
        },
        {
          conflictPaths: ['opportunityId', 'userId'],
          skipUpdateIfNoValuesChanged: true,
        },
      );
      return { _: true };
    },
    acceptOpportunityMatch: async (
      _,
      { id }: { id: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      await updateCandidateMatchStatus(
        id,
        ctx.userId,
        OpportunityMatchStatus.CandidateAccepted,
        ctx,
      );

      return { _: true };
    },
    rejectOpportunityMatch: async (
      _,
      { id }: { id: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      await updateCandidateMatchStatus(
        id,
        ctx.userId,
        OpportunityMatchStatus.CandidateRejected,
        ctx,
      );

      return { _: true };
    },
    recruiterAcceptOpportunityMatch: async (
      _,
      {
        opportunityId,
        candidateUserId,
      }: { opportunityId: string; candidateUserId: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      await updateRecruiterMatchStatus(
        opportunityId,
        candidateUserId,
        OpportunityMatchStatus.RecruiterAccepted,
        ctx,
      );

      return { _: true };
    },
    recruiterRejectOpportunityMatch: async (
      _,
      {
        opportunityId,
        candidateUserId,
      }: { opportunityId: string; candidateUserId: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      await updateRecruiterMatchStatus(
        opportunityId,
        candidateUserId,
        OpportunityMatchStatus.RecruiterRejected,
        ctx,
      );

      return { _: true };
    },
    candidateAddKeywords: async (
      _,
      payload: z.infer<typeof userCandidateToggleKeywordSchema>,
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const { data, error } =
        userCandidateToggleKeywordSchema.safeParse(payload);
      if (error) {
        throw error;
      }

      const rows = data.keywords.map((keyword) => ({
        userId: ctx.userId,
        keyword,
      }));

      await ctx.con.getRepository(UserCandidateKeyword).upsert(rows, {
        conflictPaths: ['userId', 'keyword'],
        skipUpdateIfNoValuesChanged: true,
      });

      return { _: true };
    },
    candidateRemoveKeywords: async (
      _,
      payload: z.infer<typeof userCandidateToggleKeywordSchema>,
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const { data, error } =
        userCandidateToggleKeywordSchema.safeParse(payload);
      if (error) {
        throw error;
      }

      const rows = data.keywords.map((keyword) => ({
        userId: ctx.userId,
        keyword,
      }));

      await ctx.con.getRepository(UserCandidateKeyword).delete(rows);

      return { _: true };
    },
    uploadEmploymentAgreement: async (
      _,
      payload: z.infer<typeof uploadEmploymentAgreementSchema>,
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const { data, error } =
        await uploadEmploymentAgreementSchema.safeParseAsync(payload);
      if (error) {
        throw error;
      }

      const { file } = data;

      const blobName = ctx.userId;
      await uploadEmploymentAgreementFromBuffer(blobName, file.buffer, {
        contentType: file.mimetype,
      });

      await ctx.con.getRepository(UserCandidatePreference).upsert(
        {
          userId: ctx.userId,
          employmentAgreement: {
            blob: blobName,
            fileName: file.filename,
            contentType: file.mimetype,
            bucket: EMPLOYMENT_AGREEMENT_BUCKET_NAME,
            lastModified: new Date(),
          },
        },
        {
          conflictPaths: ['userId'],
          skipUpdateIfNoValuesChanged: true,
        },
      );

      return { _: true };
    },
    clearEmploymentAgreement: async (
      _,
      __,
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const isDeleted = await deleteEmploymentAgreementByUserId({
        userId: ctx.userId,
        logger: ctx.log,
      });

      if (!isDeleted) {
        ctx.log.warn(
          { userId: ctx.userId },
          'Failed to delete employment agreement from GCS',
        );
        throw new Error('Failed to delete employment agreement');
      }

      await ctx.con.getRepository(UserCandidatePreference).update(
        {
          userId: ctx.userId,
        },
        {
          employmentAgreement: {},
        },
      );
      return { _: true };
    },
    editOpportunity: async (
      _,
      {
        id,
        payload,
        organizationImage,
      }: {
        id: string;
        payload: z.infer<typeof opportunityEditSchema>;
        organizationImage?: Promise<FileUpload>;
      },
      ctx: AuthContext,
      info,
    ): Promise<GQLOpportunity> => {
      const opportunity = opportunityEditSchema.parse(payload);

      await ensureOpportunityPermissions({
        con: ctx.con.manager,
        userId: ctx.userId,
        opportunityId: id,
        permission: OpportunityPermissions.Edit,
        isTeamMember: ctx.isTeamMember,
      });

      await ctx.con.transaction(async (entityManager) => {
        const {
          keywords,
          content,
          questions,
          organization,
          recruiter,
          ...opportunityUpdate
        } = opportunity;

        const renderedContent: Record<
          string,
          { content: string; html: string }
        > = {};

        Object.entries(content || {}).forEach(([key, value]) => {
          if (typeof value.content !== 'string') {
            return;
          }

          renderedContent[key] = {
            content: value.content,
            html: markdown.render(value.content),
          };
        });

        const opportunityContent = new OpportunityContent(renderedContent);

        await entityManager
          .getRepository(OpportunityJob)
          .createQueryBuilder()
          .update({
            ...opportunityUpdate,
            content: () => `content || :contentJson`,
            meta: () => `meta || :metaJson`,
          })
          .where({ id })
          .setParameter('contentJson', opportunityContent.toJsonString())
          .setParameter('metaJson', JSON.stringify(opportunity.meta || {}))
          .execute();

        if (organization || organizationImage) {
          const opportunityJob = await entityManager
            .getRepository(OpportunityJob)
            .findOne({
              where: { id },
              select: ['organizationId'],
            });

          if (opportunityJob?.organizationId) {
            const organizationUpdate: Record<string, unknown> = {
              ...organization,
            };

            // Handle image upload
            if (organizationImage) {
              const { createReadStream } = await organizationImage;
              const stream = createReadStream();
              const { url: imageUrl } = await uploadOrganizationImage(
                opportunityJob.organizationId,
                stream,
              );
              organizationUpdate.image = imageUrl;
            }

            if (Object.keys(organizationUpdate).length > 0) {
              await entityManager
                .getRepository(Organization)
                .update(
                  { id: opportunityJob.organizationId },
                  organizationUpdate,
                );
            }
          }
        }

        if (Array.isArray(keywords)) {
          await entityManager.getRepository(OpportunityKeyword).delete({
            opportunityId: id,
          });

          await entityManager.getRepository(OpportunityKeyword).insert(
            keywords.map((keyword) => ({
              opportunityId: id,
              keyword: keyword.keyword,
            })),
          );
        }

        if (Array.isArray(questions)) {
          const questionIds = questions.map((item) => item.id).filter(Boolean);

          const hasQuestionsFromOtherOpportunity = await entityManager
            .getRepository(QuestionScreening)
            .exists({
              where: { id: In(questionIds), opportunityId: Not(id) },
            });

          if (hasQuestionsFromOtherOpportunity) {
            throw new ConflictError('Not allowed to edit some questions!');
          }

          await entityManager.getRepository(QuestionScreening).delete({
            id: Not(In(questionIds)),
            opportunityId: id,
          });

          await entityManager.getRepository(QuestionScreening).upsert(
            questions.map((question, index) => {
              return entityManager.getRepository(QuestionScreening).create({
                id: question.id,
                opportunityId: id,
                title: question.title,
                placeholder: question.placeholder,
                questionOrder: index,
              });
            }),
            { conflictPaths: ['id'] },
          );
        }

        if (recruiter) {
          // Check if the recruiter is part of the recruiters for this opportunity
          const existingRecruiter = await entityManager
            .getRepository(OpportunityUserRecruiter)
            .findOne({
              where: {
                opportunityId: id,
                userId: recruiter.userId,
                type: OpportunityUserType.Recruiter,
              },
            });

          if (!existingRecruiter) {
            ctx.log.error(
              { opportunityId: id, userId: recruiter.userId },
              'Recruiter is not part of this opportunity',
            );
            throw new ForbiddenError(
              'Access denied! Recruiter is not part of this opportunity',
            );
          }

          // Update the recruiter's title and bio on the User entity
          await entityManager.getRepository(User).update(
            {
              id: recruiter.userId,
            },
            {
              title: recruiter.title,
              bio: recruiter.bio,
            },
          );
        }
      });

      return graphorm.queryOneOrFail<GQLOpportunity>(ctx, info, (builder) => {
        builder.queryBuilder.where({ id });

        return builder;
      });
    },
    clearOrganizationImage: async (
      _,
      { id }: { id: string },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      await ensureOpportunityPermissions({
        con: ctx.con.manager,
        userId: ctx.userId,
        opportunityId: id,
        permission: OpportunityPermissions.Edit,
        isTeamMember: ctx.isTeamMember,
      });

      const opportunityJob = await ctx.con
        .getRepository(OpportunityJob)
        .findOne({
          where: { id },
          select: ['organizationId'],
        });

      if (!opportunityJob?.organizationId) {
        throw new NotFoundError('Opportunity not found');
      }

      await ctx.con
        .getRepository(Organization)
        .update(opportunityJob.organizationId, { image: null });

      return { _: true };
    },
    recommendOpportunityScreeningQuestions: async (
      _,
      { id }: { id: string },
      ctx: AuthContext,
    ): Promise<GQLOpportunityScreeningQuestion[]> => {
      await ensureOpportunityPermissions({
        con: ctx.con.manager,
        userId: ctx.userId,
        opportunityId: id,
        permission: OpportunityPermissions.Edit,
        isTeamMember: ctx.isTeamMember,
      });

      const hasQuestionsAlready = await ctx.con
        .getRepository(QuestionScreening)
        .exists({
          where: { opportunityId: id },
        });

      if (hasQuestionsAlready) {
        throw new ConflictError('Opportunity already has questions!');
      }

      const opportunity = await ctx.con
        .getRepository(OpportunityJob)
        .findOneOrFail({
          where: { id },
          relations: {
            organization: true,
          },
        });

      if (process.env.NODE_ENV === 'development') {
        return [];
      }

      const gondulClient = getGondulClient();

      const result = await gondulClient.garmr.execute(async () => {
        return await gondulClient.instance.screeningQuestions(
          new ScreeningQuestionsRequest({
            jobOpportunity: createOpportunityPrompt({ opportunity }),
          }),
        );
      });

      const savedQuestions = await ctx.con
        .getRepository(QuestionScreening)
        .save(
          result.screening.map((question, index) => {
            return ctx.con.getRepository(QuestionScreening).create({
              opportunityId: id,
              title: question,
              questionOrder: index,
            });
          }),
        );

      return savedQuestions.map((question) => {
        return {
          ...question,
          order: question.questionOrder,
        };
      });
    },
    updateOpportunityState: async (
      _,
      payload,
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const { id, state } = opportunityUpdateStateSchema.parse(payload);

      await ensureOpportunityPermissions({
        con: ctx.con.manager,
        userId: ctx.userId,
        opportunityId: id,
        permission: OpportunityPermissions.UpdateState,
        isTeamMember: ctx.isTeamMember,
      });

      const opportunity = await ctx.con
        .getRepository(OpportunityJob)
        .findOneOrFail({
          where: { id },
          relations: {
            organization: true,
            keywords: true,
            questions: true,
          },
        });

      switch (state) {
        case OpportunityState.LIVE: {
          if (!opportunity.organizationId) {
            throw new ConflictError(
              `Opportunity must have an organization assigned`,
            );
          }

          if (opportunity.state === OpportunityState.CLOSED) {
            throw new ConflictError(`Opportunity is closed`);
          }

          opportunityStateLiveSchema.parse({
            ...opportunity,
            organization: await opportunity.organization,
            keywords: await opportunity.keywords,
            questions: await opportunity.questions,
          });

          await ctx.con.getRepository(OpportunityJob).update({ id }, { state });

          break;
        }
        default:
          throw new ConflictError('Invalid state transition');
      }

      return {
        _: true,
      };
    },
    parseOpportunity: async (
      _,
      {
        payload,
      }: {
        payload: unknown;
      },
      ctx: Context,
      info,
    ): Promise<GQLOpportunity> => {
      const parseOpportunityPayload =
        await parseOpportunitySchema.parseAsync(payload);

      let opportunityFileBuffer: Buffer | null = null;
      const filename = `test-upload-job.pdf`;
      let extension = 'pdf';

      if (parseOpportunityPayload.url) {
        const response = await garmScraperService.execute(() => {
          return fetch(`${process.env.SCRAPER_URL}/pdf`, {
            method: 'POST',
            body: JSON.stringify({ url: parseOpportunityPayload.url }),
            headers: { 'content-type': 'application/json' },
          });
        });

        if (!response.ok) {
          throw new Error('Failed to fetch job from URL');
        }

        opportunityFileBuffer = Buffer.from(await response.arrayBuffer());
      } else {
        const fileUpload = await parseOpportunityPayload.file;

        extension = fileUpload.filename?.split('.')?.pop()?.toLowerCase();

        const { createReadStream } = await parseOpportunityPayload.file;

        opportunityFileBuffer = await getBufferFromStream(createReadStream());
      }

      // Validate file extension
      const supportedFileType = acceptedOpportunityFileTypes.find(
        (type) => type.ext === extension,
      );

      if (!supportedFileType) {
        throw new ValidationError('File extension not supported');
      }

      // Validate MIME type using buffer
      const fileType = await fileTypeFromBuffer(opportunityFileBuffer);

      if (supportedFileType.mime !== fileType?.mime) {
        throw new ValidationError('File type not supported');
      }

      try {
        // Actual upload using buffer as a stream
        await uploadResumeFromBuffer(filename, opportunityFileBuffer, {
          contentType: fileType?.mime,
        });

        const brokkrClient = getBrokkrClient();

        const result = await brokkrClient.garmr.execute(() => {
          return brokkrClient.instance.parseOpportunity(
            new BrokkrParseRequest({
              // TODO potentially change to separate bucket, does not mean much sicne
              // we clean up afterwards anyway
              bucketName: RESUME_BUCKET_NAME,
              blobName: filename,
            }),
          );
        });

        const parsedOpportunity = await opportunityCreateParseSchema.parseAsync(
          result.opportunity,
        );

        const renderedContent: Record<
          string,
          { content: string; html: string }
        > = {};

        Object.entries(parsedOpportunity.content || {}).forEach(
          ([key, value]) => {
            if (typeof value?.content !== 'string') {
              return;
            }

            renderedContent[key] = {
              content: value.content,
              html: markdown.render(value.content),
            };
          },
        );

        const opportunityContent = new OpportunityContent(renderedContent);

        const opportunity = await ctx.con.getRepository(OpportunityJob).save(
          ctx.con.getRepository(OpportunityJob).create({
            ...parsedOpportunity,
            state: OpportunityState.DRAFT,
            content: opportunityContent,
            keywords: parsedOpportunity.keywords.map((keyword) => {
              return ctx.con.getRepository(OpportunityKeyword).create({
                keyword: keyword.keyword,
              });
            }),
            flags: {
              anonUserId: ctx.trackingId, // save tracking id to attribute later
            },
          } as DeepPartial<OpportunityJob>),
        );

        return graphorm.queryOneOrFail<GQLOpportunity>(ctx, info, (builder) => {
          builder.queryBuilder.where({ id: opportunity.id });

          return builder;
        });
      } catch (error) {
        throw error;
      } finally {
        const storage = new Storage();
        const bucket = storage.bucket(RESUME_BUCKET_NAME);

        await deleteFileFromBucket(bucket, filename);
      }
    },
  },
  OpportunityMatch: {
    engagementProfile: async (
      parent: OpportunityMatch,
      _,
      ctx: Context,
    ): Promise<{ profileText: string } | null> => {
      if (!parent.userId) {
        return null;
      }

      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Profile fetch timeout')), 5000),
        );

        const profile = await Promise.race([
          snotraClient.getProfile({ user_id: parent.userId }),
          timeoutPromise,
        ]);

        if (!profile) {
          return null;
        }

        return {
          profileText: (profile as ProfileResponse).profile_text,
        };
      } catch (error) {
        // Log error but don't fail the entire query
        ctx.log.warn(
          { userId: parent.userId, err: error },
          'Failed to fetch engagement profile from snotra',
        );
        return null;
      }
    },
  },
  UserCandidatePreference: {
    cv: async (parent: UserCandidatePreference) => {
      const cv = await parent?.cv;
      if (!cv?.blob) {
        return cv;
      }

      const signedUrl = await generateResumeSignedUrl(cv.blob);
      return {
        ...cv,
        signedUrl,
      };
    },
  },
});
