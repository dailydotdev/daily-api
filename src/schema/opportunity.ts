import z from 'zod';
import { IResolvers } from '@graphql-tools/utils';
import { GraphQLResolveInfo } from 'graphql';
// @ts-expect-error - no types
import { FileUpload } from 'graphql-upload/GraphQLUpload.js';
import { traceResolvers } from './trace';
import { AuthContext, BaseContext, type Context } from '../Context';
import graphorm from '../graphorm';
import {
  BrokkrParseRequest,
  OpportunityContent,
  OpportunityState,
  ScreeningQuestionsRequest,
} from '@dailydotdev/schema';
import { OpportunityMatch } from '../entity/OpportunityMatch';
import {
  getBufferFromStream,
  toGQLEnum,
  uniqueifyArray,
  uniqueifyObjectArray,
  updateFlagsStatement,
} from '../common';
import {
  OpportunityMatchStatus,
  OpportunityUserType,
} from '../entity/opportunities/types';
import { UserCandidatePreference } from '../entity/user/UserCandidatePreference';
import { DatasetLocation } from '../entity/dataset/DatasetLocation';
import { createLocationFromMapbox } from '../entity/dataset/utils';
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
import {
  ConflictError,
  NotFoundError,
  TypeOrmError,
  type TypeORMQueryFailedError,
} from '../errors';
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
  createSharedSlackChannelSchema,
  parseOpportunitySchema,
  opportunityMatchesQuerySchema,
  gondulOpportunityPreviewResultSchema,
} from '../common/schema/opportunities';
import { OpportunityKeyword } from '../entity/OpportunityKeyword';
import {
  ensureOpportunityPermissions,
  OpportunityPermissions,
} from '../common/opportunity/accessControl';
import { markdown } from '../common/markdown';
import { QuestionScreening } from '../entity/questions/QuestionScreening';
import {
  In,
  Not,
  QueryFailedError,
  type DeepPartial,
  JsonContains,
} from 'typeorm';
import { Organization } from '../entity/Organization';
import {
  OrganizationLinkType,
  SocialMediaType,
} from '../common/schema/organizations';
import { getGondulClient } from '../common/gondul';
import { createOpportunityPrompt } from '../common/opportunity/prompt';
import { queryPaginatedByDate } from '../common/datePageGenerator';
import { queryReadReplica } from '../common/queryReadReplica';
import { ConnectionArguments } from 'graphql-relay';
import { ProfileResponse, snotraClient } from '../integrations/snotra';
import { slackClient } from '../common/slack';
import { fileTypeFromBuffer } from 'file-type';
import {
  acceptedOpportunityFileTypes,
  opportunityMatchBatchSize,
} from '../types';
import { getBrokkrClient } from '../common/brokkr';
import { garmScraperService } from '../common/scraper';
import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'node:crypto';
import { addOpportunityDefaultQuestionFeedback } from '../common/opportunity/question';
import { cursorToOffset, offsetToCursor } from 'graphql-relay/index';
import { getShowcaseCompanies } from '../common/opportunity/companies';
import { Opportunity } from '../entity/opportunities/Opportunity';
import type { GQLSource } from './sources';

export interface GQLOpportunity
  extends Pick<
    Opportunity,
    | 'id'
    | 'type'
    | 'state'
    | 'title'
    | 'tldr'
    | 'content'
    | 'keywords'
    | 'flags'
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
    'userId' | 'user' | 'updatedAt' | 'cvParsed' | 'location'
  > {
  location?: Array<DatasetLocation>;
  keywords?: Array<{ keyword: string }>;
}

export type GQLOpportunityScreeningQuestion = Pick<
  QuestionScreening,
  'id' | 'title' | 'placeholder' | 'opportunityId'
> & {
  order: number;
};

export interface GQLTopReaderBadge {
  tag: string;
  issuedAt: Date;
}

export interface GQLOpportunityPreviewUser extends Pick<User, 'id'> {
  profileImage: string | null;
  anonId: string;
  description: string | null;
  openToWork: boolean;
  seniority: string | null;
  location: string | null;
  company: { name: string; favicon?: string } | null;
  lastActivity: Date | null;
  topTags: string[] | null;
  recentlyRead: GQLTopReaderBadge[] | null;
  activeSquads: GQLSource[] | null;
}

export interface GQLOpportunityPreviewEdge {
  node: GQLOpportunityPreviewUser;
  cursor: string;
}

export interface GQLOpportunityPreviewResult {
  totalCount: number;
  tags: string[] | null;
  companies: Array<{ name: string; favicon?: string }> | null;
  squads: GQLSource[] | null;
  opportunityId: string;
}

export interface GQLOpportunityPreviewConnection {
  edges: GQLOpportunityPreviewEdge[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
  result: GQLOpportunityPreviewResult;
}

export interface GQLOpportunityStats {
  matched: number;
  reached: number;
  considered: number;
  decided: number;
  forReview: number;
  introduced: number;
}

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

  """
  Flags for the opportunity
  """
  type OpportunityFlagsPublic {
    batchSize: Int
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
    organization: Organization
    recruiters: [User!]!
    keywords: [OpportunityKeyword]!
    questions: [OpportunityScreeningQuestion]!
    feedbackQuestions: [OpportunityFeedbackQuestion]!
    subscriptionStatus: SubscriptionStatus!
    flags: OpportunityFlagsPublic
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
    previewUser: OpportunityPreviewUser
  }

  type OpportunityMatchEdge {
    node: OpportunityMatch!

    """
    Used in \`before\` and \`after\` args
    """
    cursor: String!
  }

  type OpportunityMatchPageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean
    startCursor: String
    endCursor: String
    """
    Total number of matches for the given status filter
    """
    totalCount: Int!
  }

  type OpportunityMatchConnection {
    pageInfo: OpportunityMatchPageInfo!
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

  type OpportunityPreviewCompany {
    name: String!
    favicon: String
  }

  """
  Top reader badge with tag and issue date
  """
  type TopReaderBadge {
    """
    The keyword/tag name
    """
    tag: String!

    """
    When the badge was issued
    """
    issuedAt: DateTime!
  }

  type OpportunityPreviewUser {
    """
    Real user ID
    """
    id: String!

    """
    User profile image
    """
    profileImage: String

    """
    Anonymized ID (e.g., anon #1002)
    """
    anonId: String!

    """
    User description/bio
    """
    description: String

    """
    Whether the user is open to work
    """
    openToWork: Boolean!

    """
    User seniority level
    """
    seniority: String

    """
    User location (from preferences or geo flags)
    """
    location: String

    """
    Active company from experience
    """
    company: OpportunityPreviewCompany

    """
    Last activity timestamp
    """
    lastActivity: DateTime

    """
    Top tags for the user
    """
    topTags: [String!]!

    """
    Recently read badges with tags and issue dates (limit 3)
    """
    recentlyRead: [UserTopReader!]

    """
    Active squads
    """
    activeSquads: [Source!]!
  }

  type OpportunityPreviewEdge {
    node: OpportunityPreviewUser!
    cursor: String!
  }

  type OpportunityPreviewPageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  type OpportunityPreviewResult {
    tags: [String!]!
    companies: [OpportunityPreviewCompany!]!
    squads: [Source!]!
    totalCount: Int
    opportunityId: String!
  }

  type OpportunityPreviewConnection {
    edges: [OpportunityPreviewEdge!]!
    pageInfo: OpportunityPreviewPageInfo!
    result: OpportunityPreviewResult
  }

  type OpportunityStats {
    """
    Mock value for matched candidates
    """
    matched: Int!

    """
    Total count of all matches regardless of status
    """
    reached: Int!

    """
    Count of matches that are not pending (all statuses except pending)
    """
    considered: Int!

    """
    Count of candidate_rejected matches
    """
    decided: Int!

    """
    Count of candidate_accepted matches
    """
    forReview: Int!

    """
    Count of recruiter_accepted matches
    """
    introduced: Int!
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
      Filter by match status (allowed: candidate_accepted, recruiter_accepted, recruiter_rejected)
      """
      status: OpportunityMatchStatus
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

    """
    Get a preview of potential candidate matches for an opportunity owned by the anonymous user
    """
    opportunityPreview(
      """
      Number of users to return
      """
      first: Int

      """
      Cursor for pagination
      """
      after: String

      """
      Opportunity ID
      """
      opportunityId: ID
    ): OpportunityPreviewConnection!

    """
    Get statistics for an opportunity's matches
    """
    opportunityStats(
      """
      Id of the Opportunity
      """
      opportunityId: ID!
    ): OpportunityStats! @auth
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
    name: String
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
      externalLocationId: String
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

    """
    Create a shared Slack channel and invite a user by email
    """
    createSharedSlackChannel(
      """
      Email address of the user to invite
      """
      email: String!

      """
      Name of the channel to create (lowercase letters, numbers, hyphens, and underscores only)
      """
      channelName: String!
    ): EmptyResponse @auth
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
        location: [],
        keywords: [],
      };
    },
    opportunities: async (
      _,
      args: ConnectionArguments & { state?: number },
      ctx: Context,
      info,
    ) => {
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
            if (args?.state) {
              const validatedInput = z
                .object({ state: z.enum(OpportunityState).nullish() })
                .parse(args);
              builder.queryBuilder.where({ state: validatedInput.state });
            }
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
      args: ConnectionArguments & {
        opportunityId: string;
        status?: OpportunityMatchStatus;
      },
      ctx: AuthContext,
      info,
    ) => {
      if (!ctx.userId) {
        throw new NotFoundError('Not found!');
      }

      // Validate and parse args using Zod schema
      const validatedArgs = opportunityMatchesQuerySchema.parse(args);

      // First verify the user has access to this opportunity
      await ensureOpportunityPermissions({
        con: ctx.con.manager,
        userId: ctx.userId,
        opportunityId: validatedArgs.opportunityId,
        permission: OpportunityPermissions.UpdateState,
        isTeamMember: ctx.isTeamMember,
      });

      // If status is provided, filter by that status; otherwise use all allowed statuses
      const statusesToFilter = validatedArgs.status
        ? [validatedArgs.status]
        : [
            OpportunityMatchStatus.CandidateAccepted,
            OpportunityMatchStatus.RecruiterAccepted,
            OpportunityMatchStatus.RecruiterRejected,
          ];

      const [connection, totalCount] = await Promise.all([
        queryPaginatedByDate<GQLOpportunityMatch, 'updatedAt', typeof args>(
          ctx,
          info,
          args,
          { key: 'updatedAt', maxSize: 50 },
          {
            queryBuilder: (builder) => {
              builder.queryBuilder
                .where({ opportunityId: validatedArgs.opportunityId })
                .andWhere(`${builder.alias}.status IN (:...statuses)`, {
                  statuses: statusesToFilter,
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
        ),
        queryReadReplica(ctx.con, ({ queryRunner }) =>
          queryRunner.manager.getRepository(OpportunityMatch).count({
            where: {
              opportunityId: validatedArgs.opportunityId,
              status: In(statusesToFilter),
            },
          }),
        ),
      ]);

      return {
        ...connection,
        pageInfo: {
          ...connection.pageInfo,
          totalCount,
        },
      };
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
    opportunityPreview: async (
      _,
      args: ConnectionArguments & { opportunityId?: string },
      ctx: Context,
      info: GraphQLResolveInfo,
    ): Promise<GQLOpportunityPreviewConnection> => {
      const { after, first = 20 } = args;
      const offset = after ? cursorToOffset(after) : 0;

      let opportunity: OpportunityJob;

      if (args.opportunityId) {
        await ensureOpportunityPermissions({
          con: ctx.con.manager,
          userId: ctx.userId || '',
          opportunityId: args.opportunityId,
          permission: OpportunityPermissions.ViewDraft,
          isTeamMember: ctx.isTeamMember,
        });

        opportunity = await ctx.con
          .getRepository(OpportunityJob)
          .findOneOrFail({
            where: { id: args.opportunityId },
            relations: { keywords: true },
          });
      } else {
        opportunity = await ctx.con
          .getRepository(OpportunityJob)
          .findOneOrFail({
            where: {
              flags: JsonContains({ anonUserId: ctx.trackingId }),
            },
            relations: { keywords: true },
          });
      }

      const keywords = await opportunity.keywords;

      let userIds: string[];
      let totalCount: number;

      if (opportunity.flags?.preview) {
        userIds = opportunity.flags.preview.userIds;
        totalCount = opportunity.flags.preview.totalCount;
      } else {
        const opportunityContent: Record<string, unknown> = {};

        // since this is json endpoint we need to make sure all keys are present
        // even if empty, remove this when we move to protobuf service call
        Object.keys(new OpportunityContent()).forEach((key) => {
          const opportunityKey = key as keyof OpportunityContent;

          opportunityContent[opportunityKey] =
            opportunity.content[opportunityKey] || {};
        });

        const validatedPayload = {
          opportunity: {
            title: opportunity.title,
            tldr: opportunity.tldr,
            content: opportunityContent,
            meta: opportunity.meta,
            location: opportunity.location,
            state: opportunity.state,
            type: opportunity.type,
            keywords: keywords.map((k) => k.keyword),
          },
        };

        // Call the gondul preview endpoint with circuit breaker
        try {
          const gondulClient = getGondulClient();
          const gondulResult = await gondulClient.garmr.execute(async () => {
            const response = await fetch(
              `${process.env.GONDUL_ORIGIN}/api/v1/opportunity/preview`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(validatedPayload),
              },
            );
            if (!response.ok) {
              throw new Error('Failed to fetch opportunity preview');
            }
            const { user_ids, total_count } =
              gondulOpportunityPreviewResultSchema.parse(await response.json());

            return {
              userIds: user_ids,
              totalCount: total_count,
            };
          });

          await ctx.con.getRepository(OpportunityJob).update(
            { id: opportunity.id },
            {
              flags: updateFlagsStatement<OpportunityJob>({
                preview: gondulResult,
              }),
            },
          );

          userIds = gondulResult.userIds.slice(0, 20);
          totalCount = gondulResult.totalCount;
        } catch (error) {
          throw error;
        }
      }

      const connection =
        await graphorm.queryPaginated<GQLOpportunityPreviewUser>(
          ctx,
          info,
          () => !!after,
          (nodeSize) => nodeSize === first,
          (_, i) => offsetToCursor(offset + i + 1),
          (builder) => {
            builder.queryBuilder.where(`${builder.alias}.id IN (:...userIds)`, {
              userIds: userIds.length ? userIds : ['nosuchid'],
            });
            return builder;
          },
          (nodes) => {
            // Sort nodes in JavaScript based on userIds order
            const userIdIndexMap = new Map(
              userIds.map((id, index) => [id, index]),
            );
            return nodes.sort((a, b) => {
              const indexA = userIdIndexMap.get(a.id) ?? Infinity;
              const indexB = userIdIndexMap.get(b.id) ?? Infinity;
              return indexA - indexB;
            });
          },
          true,
        );

      const tags = uniqueifyArray(
        connection.edges.flatMap(({ node }) => node.topTags || []),
      );

      const companies = getShowcaseCompanies();

      const squads = uniqueifyObjectArray(
        connection.edges.flatMap(({ node }) =>
          (node.activeSquads || []).map((squad) => squad),
        ),
        (squad) => squad.handle,
      );

      return {
        ...connection,
        result: {
          tags,
          companies,
          squads,
          totalCount,
          opportunityId: opportunity.id,
        },
      };
    },
    opportunityStats: async (
      _,
      { opportunityId }: { opportunityId: string },
      ctx: AuthContext,
    ): Promise<GQLOpportunityStats> => {
      // Verify the user has access to this opportunity
      await ensureOpportunityPermissions({
        con: ctx.con.manager,
        userId: ctx.userId,
        opportunityId,
        permission: OpportunityPermissions.UpdateState,
        isTeamMember: ctx.isTeamMember,
      });

      const result = await queryReadReplica(ctx.con, ({ queryRunner }) =>
        queryRunner.manager
          .getRepository(OpportunityMatch)
          .createQueryBuilder('match')
          .select('COUNT(*)', 'reached')
          .addSelect(
            `COUNT(CASE WHEN match.status != :pending THEN 1 END)`,
            'considered',
          )
          .addSelect(
            `COUNT(CASE WHEN match.status = :candidateRejected THEN 1 END)`,
            'decided',
          )
          .addSelect(
            `COUNT(CASE WHEN match.status = :candidateAccepted THEN 1 END)`,
            'forReview',
          )
          .addSelect(
            `COUNT(CASE WHEN match.status = :recruiterAccepted THEN 1 END)`,
            'introduced',
          )
          .where('match.opportunityId = :opportunityId', { opportunityId })
          .setParameter('pending', OpportunityMatchStatus.Pending)
          .setParameter(
            'candidateRejected',
            OpportunityMatchStatus.CandidateRejected,
          )
          .setParameter(
            'candidateAccepted',
            OpportunityMatchStatus.CandidateAccepted,
          )
          .setParameter(
            'recruiterAccepted',
            OpportunityMatchStatus.RecruiterAccepted,
          )
          .getRawOne<{
            reached: string;
            considered: string;
            decided: string;
            forReview: string;
            introduced: string;
          }>(),
      );

      // Get counts per status using SQL aggregation

      return {
        matched: 12_000, // Mock value as requested
        reached: parseInt(result?.reached || '0', 10),
        considered: parseInt(result?.considered || '0', 10),
        decided: parseInt(result?.decided || '0', 10),
        forReview: parseInt(result?.forReview || '0', 10),
        introduced: parseInt(result?.introduced || '0', 10),
      };
    },
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

      // Handle externalLocationId -> locationId mapping
      let location: DatasetLocation | null = null;
      if (preferences.data.externalLocationId) {
        location = await con.getRepository(DatasetLocation).findOne({
          where: { externalId: preferences.data.externalLocationId },
        });

        if (!location) {
          location = await createLocationFromMapbox(
            con,
            preferences.data.externalLocationId,
          );
        }
      }

      await con.getRepository(UserCandidatePreference).upsert(
        {
          userId,
          status: preferences.data.status,
          role: preferences.data.role,
          roleType: preferences.data.roleType,
          employmentType: preferences.data.employmentType,
          salaryExpectation: preferences.data.salaryExpectation,
          locationType: preferences.data.locationType,
          customKeywords: preferences.data.customKeywords,
          locationId: location?.id ?? null,
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

          let organizationId = opportunityJob?.organizationId;

          let organizationUpdate: Record<string, unknown> = {
            ...organization,
          };

          if (organizationId) {
            delete organizationUpdate.name; // prevent name updates on existing organizations
          }

          if (!organizationId) {
            // create new organization and assign to opportunity here inline
            // TODO: ideally this should be refactored later to separate mutation

            try {
              const organizationInsertResult = await entityManager
                .getRepository(Organization)
                .insert(organizationUpdate);

              organizationId = organizationInsertResult.identifiers[0]
                .id as string;

              await entityManager
                .getRepository(OpportunityJob)
                .update({ id }, { organizationId });

              // values were applied during insert
              organizationUpdate = {};
            } catch (insertError) {
              if (insertError instanceof QueryFailedError) {
                const queryFailedError = insertError as TypeORMQueryFailedError;

                if (queryFailedError.code === TypeOrmError.DUPLICATE_ENTRY) {
                  if (
                    insertError.message.indexOf(
                      'IDX_organization_name_unique',
                    ) > -1
                  ) {
                    throw new ConflictError(
                      'Organization with this name already exists',
                    );
                  }
                }
              }

              throw insertError;
            }
          }

          // Handle image upload
          if (organizationImage) {
            const { createReadStream } = await organizationImage;
            const stream = createReadStream();
            const { url: imageUrl } = await uploadOrganizationImage(
              organizationId,
              stream,
            );
            organizationUpdate.image = imageUrl;
          }

          if (Object.keys(organizationUpdate).length > 0) {
            await entityManager
              .getRepository(Organization)
              .update({ id: organizationId }, organizationUpdate);
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
    createSharedSlackChannel: async (
      _,
      payload: z.infer<typeof createSharedSlackChannelSchema>,
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      // Check if the user is a recruiter
      const isRecruiter = await ctx.con
        .getRepository(OpportunityUserRecruiter)
        .findOne({
          where: {
            userId: ctx.userId,
            type: OpportunityUserType.Recruiter,
          },
        });

      if (!isRecruiter) {
        throw new ForbiddenError(
          'Access denied! Only recruiters can create Slack channels',
        );
      }

      try {
        const { channelName, email } = payload;

        const createResult = await slackClient.createConversation(
          channelName,
          false,
        );

        if (!createResult?.channel) {
          return { _: false };
        }

        await slackClient.inviteSharedToConversation(
          createResult.channel.id as string,
          [email],
          true,
        );

        return { _: true };
      } catch (originalError) {
        const error = originalError as Error;

        if (error.message === 'An API error occurred: name_taken') {
          throw new ConflictError('Channel name already exists');
        }

        throw error;
      }
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
      if (!(ctx.userId || ctx.trackingId)) {
        throw new ValidationError('User identifier is required');
      }

      const parseOpportunityPayload =
        await parseOpportunitySchema.parseAsync(payload);

      let opportunityFileBuffer: Buffer | null = null;
      const filename = `job-opportunity-${randomUUID()}.pdf`;
      let extension = 'pdf';

      if (parseOpportunityPayload.url) {
        const response = await garmScraperService.execute(async () => {
          const response = await fetch(`${process.env.SCRAPER_URL}/pdf`, {
            method: 'POST',
            body: JSON.stringify({ url: parseOpportunityPayload.url }),
            headers: { 'content-type': 'application/json' },
          });

          if (!response.ok) {
            throw new Error('Failed to fetch job from URL');
          }

          return response;
        });

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

        const opportunityResult = await ctx.con.transaction(
          async (entityManager) => {
            const flags: Opportunity['flags'] = {};

            if (!ctx.userId) {
              flags.anonUserId = ctx.trackingId; // save tracking id to attribute later
            }

            flags.batchSize = opportunityMatchBatchSize;

            const opportunity = await entityManager
              .getRepository(OpportunityJob)
              .save(
                entityManager.getRepository(OpportunityJob).create({
                  ...parsedOpportunity,
                  state: OpportunityState.DRAFT,
                  content: opportunityContent,
                  flags,
                } as DeepPartial<OpportunityJob>),
              );

            await addOpportunityDefaultQuestionFeedback({
              entityManager,
              opportunityId: opportunity.id,
            });

            await entityManager.getRepository(OpportunityKeyword).insert(
              parsedOpportunity.keywords.map((keyword) => ({
                opportunityId: opportunity.id,
                keyword: keyword.keyword,
              })),
            );

            if (ctx.userId) {
              await entityManager
                .getRepository(OpportunityUserRecruiter)
                .insert(
                  entityManager.getRepository(OpportunityUserRecruiter).create({
                    opportunityId: opportunity.id,
                    userId: ctx.userId,
                  }),
                );
            }

            return opportunity;
          },
        );

        return graphorm.queryOneOrFail<GQLOpportunity>(ctx, info, (builder) => {
          builder.queryBuilder.where({ id: opportunityResult.id });

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
