import z from 'zod';
import { IResolvers } from '@graphql-tools/utils';
import { GraphQLResolveInfo } from 'graphql';
import { traceResolvers } from './trace';
import { AuthContext, BaseContext, type Context } from '../Context';
import graphorm, { LocationVerificationStatus } from '../graphorm';
import {
  OpportunityContent,
  OpportunityState,
  ScreeningQuestionsRequest,
  Opportunity as OpportunityMessage,
  Location as LocationMessage,
} from '@dailydotdev/schema';
import { OpportunityMatch } from '../entity/OpportunityMatch';
import {
  getSecondsTimestamp,
  toGQLEnum,
  uniqueifyObjectArray,
  updateFlagsStatement,
  updateRecruiterSubscriptionFlags,
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
import {
  AuthenticationError,
  ForbiddenError,
  ValidationError,
} from 'apollo-server-errors';
import { ConflictError, NotFoundError, PaymentRequiredError } from '../errors';
import { UserCandidateKeyword } from '../entity/user/UserCandidateKeyword';
import { User } from '../entity/user/User';
import { EMPLOYMENT_AGREEMENT_BUCKET_NAME } from '../config';
import {
  deleteEmploymentAgreementByUserId,
  generateResumeSignedUrl,
  uploadEmploymentAgreementFromBuffer,
} from '../common/googleCloud';
import {
  opportunityEditSchema,
  opportunityStateLiveSchema,
  opportunityUpdateStateSchema,
  createSharedSlackChannelSchema,
  parseOpportunitySchema,
  reimportOpportunitySchema,
  opportunityMatchesQuerySchema,
  addOpportunitySeatsSchema,
} from '../common/schema/opportunities';
import {
  ensureOpportunityPermissions,
  OpportunityPermissions,
} from '../common/opportunity/accessControl';
import { sanitizeHtml } from '../common/markdown';
import { QuestionScreening } from '../entity/questions/QuestionScreening';
import { In, Not, JsonContains, EntityManager } from 'typeorm';
import { Organization } from '../entity/Organization';
import { Source, SourceType } from '../entity/Source';
import { ContentPreferenceOrganization } from '../entity/contentPreference/ContentPreferenceOrganization';
import {
  OrganizationLinkType,
  SocialMediaType,
} from '../common/schema/organizations';
import { DatasetLocation } from '../entity/dataset/DatasetLocation';
import { findOrCreateDatasetLocation } from '../entity/dataset/utils';
import { OpportunityLocation } from '../entity/opportunities/OpportunityLocation';
import {
  getGondulClient,
  getGondulOpportunityServiceClient,
} from '../common/gondul';
import { createOpportunityPrompt } from '../common/opportunity/prompt';
import { queryPaginatedByDate } from '../common/datePageGenerator';
import { queryReadReplica } from '../common/queryReadReplica';
import { ConnectionArguments } from 'graphql-relay';
import { ProfileResponse, snotraClient } from '../integrations/snotra';
import { slackClient } from '../common/slack';
import { cursorToOffset, offsetToCursor } from 'graphql-relay/index';
import { getShowcaseCompanies } from '../common/opportunity/companies';
import { Opportunity } from '../entity/opportunities/Opportunity';
import type { GQLSource } from './sources';
import { SubscriptionStatus } from '../common/plus';
import { paddleInstance } from '../common/paddle';
import type { ISubscriptionUpdateItem } from '@paddle/paddle-node-sdk';
import { OpportunityPreviewStatus } from '../common/opportunity/types';
import {
  getOpportunityFileBuffer,
  validateOpportunityFileType,
  parseOpportunityWithBrokkr,
  createOpportunityFromParsedData,
  updateOpportunityFromParsedData,
  handleOpportunityKeywordsUpdate,
} from '../common/opportunity/parse';
import {
  isMockEnabled,
  mockPreviewTags,
  mockPreviewSquadIds,
} from '../mocks/opportunity/services';

export interface GQLOpportunity extends Pick<
  Opportunity,
  'id' | 'type' | 'state' | 'title' | 'tldr' | 'content' | 'keywords' | 'flags'
> {
  createdAt: Date;
  updatedAt: Date;
}

export interface GQLOpportunityMatch extends Pick<
  OpportunityMatch,
  'status' | 'description' | 'userId' | 'opportunityId'
> {
  createdAt: Date;
  updatedAt: Date;
}

export interface GQLUserCandidatePreference extends Omit<
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
  locationVerified: LocationVerificationStatus;
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
  status: OpportunityPreviewStatus;
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
  ${toGQLEnum(LocationVerificationStatus, 'LocationVerificationStatus')}

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
  }

  type OpportunityLocation {
    id: ID!
    location: Location!
    type: ProtoEnumValue!
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
    plan: String
  }

  type Opportunity {
    id: ID!
    type: ProtoEnumValue!
    state: ProtoEnumValue!
    title: String!
    tldr: String
    content: OpportunityContent!
    meta: OpportunityMeta!
    locations: [OpportunityLocation]!
    organization: Organization
    recruiters: [User!]!
    keywords: [OpportunityKeyword]!
    questions: [OpportunityScreeningQuestion]!
    feedbackQuestions: [OpportunityFeedbackQuestion]!
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
    Location verification status: geoip (inferred from geo flags), user_provided (from dataset_location or custom), or verified (future use)
    """
    locationVerified: LocationVerificationStatus!

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
    status: ProtoEnumValue!
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
    externalLocationId: String
    locationType: ProtoEnumValue
    keywords: [OpportunityKeywordInput]
    content: OpportunityContentInput
    questions: [OpportunityScreeningQuestionInput!]
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

  input ReimportOpportunityInput {
    """
    ID of the opportunity to update
    """
    opportunityId: ID!

    """
    PDF, Word file to parse
    """
    file: Upload

    """
    URL to scrape and parse
    """
    url: String
  }

  input OpportunitySeatInput {
    priceId: String!
    quantity: Int!
  }

  input AddOpportunitySeatsInput {
    seats: [OpportunitySeatInput!]!
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
    ): Opportunity! @auth

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
      @rateLimit(limit: 10, duration: 3600)

    """
    Re-import and update an existing opportunity from a URL or file upload
    """
    reimportOpportunity(payload: ReimportOpportunityInput!): Opportunity!
      @auth
      @rateLimit(limit: 10, duration: 3600)

    """
    Create a shared Slack channel and invite a user by email
    """
    createSharedSlackChannel(
      """
      Organization ID
      """
      organizationId: ID!

      """
      Email address of the user to invite
      """
      email: String!

      """
      Name of the channel to create (lowercase letters, numbers, hyphens, and underscores only)
      """
      channelName: String!
    ): EmptyResponse @auth

    addOpportunitySeats(
      """
      Id of the Opportunity
      """
      id: ID!

      payload: AddOpportunitySeatsInput!
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

/**
 * Renders content for opportunity fields
 * Sanitizes HTML content from WYSIWYG editor
 */
async function renderOpportunityContent(
  content: Record<string, { content?: string }> | undefined,
): Promise<OpportunityContent> {
  const renderedContent: Record<string, { content: string; html: string }> = {};

  for (const [key, value] of Object.entries(content || {})) {
    if (typeof value.content !== 'string') {
      continue;
    }

    const html = await sanitizeHtml(value.content);

    renderedContent[key] = {
      content: value.content,
      html,
    };
  }

  return new OpportunityContent(renderedContent);
}

/**
 * Handles opportunity location updates
 * Creates or updates locations based on externalLocationId and locationType
 */
async function handleOpportunityLocationUpdate(
  entityManager: EntityManager,
  opportunityId: string,
  externalLocationId: string | null | undefined,
  locationType: number | undefined | null,
  ctx: AuthContext,
): Promise<void> {
  if (externalLocationId) {
    // If externalLocationId is provided, replace all locations with the new one
    await entityManager.getRepository(OpportunityLocation).delete({
      opportunityId,
    });

    const location = await findOrCreateDatasetLocation(
      ctx.con,
      externalLocationId,
    );

    // Create new OpportunityLocation relationship
    if (location) {
      await entityManager.getRepository(OpportunityLocation).insert({
        opportunityId,
        locationId: location.id,
        type: locationType || 1,
      });
    }
  } else if (locationType !== undefined && locationType !== null) {
    // If only locationType is provided (no externalLocationId), update existing locations
    await entityManager
      .getRepository(OpportunityLocation)
      .update({ opportunityId }, { type: locationType });
  }
}

/**
 * Handles opportunity screening questions updates
 * Validates questions ownership and upserts them with proper ordering
 */
async function handleOpportunityScreeningQuestionsUpdate(
  entityManager: EntityManager,
  opportunityId: string,
  questions:
    | Array<{ id?: string; title: string; placeholder?: string | null }>
    | undefined,
): Promise<void> {
  if (!Array.isArray(questions)) {
    return;
  }

  const questionIds = questions.map((item) => item.id).filter(Boolean);

  const hasQuestionsFromOtherOpportunity = await entityManager
    .getRepository(QuestionScreening)
    .exists({
      where: { id: In(questionIds), opportunityId: Not(opportunityId) },
    });

  if (hasQuestionsFromOtherOpportunity) {
    throw new ConflictError('Not allowed to edit some questions!');
  }

  await entityManager.getRepository(QuestionScreening).delete({
    id: Not(In(questionIds)),
    opportunityId,
  });

  await entityManager.getRepository(QuestionScreening).upsert(
    questions.map((question, index) => {
      return entityManager.getRepository(QuestionScreening).create({
        id: question.id,
        opportunityId,
        title: question.title,
        placeholder: question.placeholder ?? undefined,
        questionOrder: index,
      });
    }),
    { conflictPaths: ['id'] },
  );
}

/**
 * Handles recruiter information updates for an opportunity
 * Validates recruiter is assigned to the opportunity and updates their profile
 */
async function handleOpportunityRecruiterUpdate(
  entityManager: EntityManager,
  opportunityId: string,
  recruiter: { userId: string; title?: string; bio?: string } | undefined,
  ctx: AuthContext,
): Promise<void> {
  if (!recruiter) {
    return;
  }

  // Check if the recruiter is part of the recruiters for this opportunity
  const existingRecruiter = await entityManager
    .getRepository(OpportunityUserRecruiter)
    .findOne({
      where: {
        opportunityId,
        userId: recruiter.userId,
        type: OpportunityUserType.Recruiter,
      },
    });

  if (!existingRecruiter) {
    ctx.log.error(
      { opportunityId, userId: recruiter.userId },
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

      let opportunityPreview: OpportunityJob['flags']['preview'] = {
        userIds: [],
        totalCount: 0,
        status: OpportunityPreviewStatus.UNSPECIFIED,
      };

      // In mock mode, if preview is stuck at PENDING, re-fetch with mock data
      const shouldRefetchInMockMode =
        isMockEnabled() &&
        opportunity.flags?.preview?.status === OpportunityPreviewStatus.PENDING;

      if (opportunity.flags?.preview && !shouldRefetchInMockMode) {
        opportunityPreview = opportunity.flags.preview;

        if (!opportunityPreview.status) {
          const isEmptyPreview = opportunityPreview.userIds.length === 0;

          opportunityPreview.status = isEmptyPreview
            ? OpportunityPreviewStatus.UNSPECIFIED
            : OpportunityPreviewStatus.READY;
        }
      } else {
        const opportunityContent: Record<string, unknown> = {};

        // since this is json endpoint we need to make sure all keys are present
        // even if empty, remove this when we move to protobuf service call
        Object.keys(new OpportunityContent()).forEach((key) => {
          const opportunityKey = key as keyof OpportunityContent;

          opportunityContent[opportunityKey] =
            opportunity.content[opportunityKey] || {};
        });

        // Fetch locations from OpportunityLocation table
        const opportunityLocations = await ctx.con
          .getRepository(OpportunityLocation)
          .find({
            where: { opportunityId: opportunity.id },
            relations: ['location'],
          });

        const locations = await Promise.all(
          opportunityLocations.map(async (ol) => {
            return ol.location;
          }),
        );

        const opportunityMessage = new OpportunityMessage({
          id: opportunity.id,
          createdAt: getSecondsTimestamp(opportunity.createdAt),
          updatedAt: getSecondsTimestamp(opportunity.updatedAt),
          type: opportunity.type,
          state: opportunity.state,
          title: opportunity.title,
          tldr: opportunity.tldr,
          content: opportunityContent,
          meta: opportunity.meta,
          location: locations.map((item) => {
            return new LocationMessage({
              ...item,
              city: item.city || undefined,
              subdivision: item.subdivision || undefined,
              country: item.country || undefined,
            });
          }),
          keywords: keywords.map((k) => k.keyword),
          flags: opportunity.flags,
        });

        const gondulOpportunityServiceClient =
          getGondulOpportunityServiceClient();

        const previewResult =
          await gondulOpportunityServiceClient.garmr.execute(() => {
            return gondulOpportunityServiceClient.instance.preview(
              opportunityMessage,
            );
          });

        // In mock mode, use the returned data directly instead of waiting for async worker
        // The mock returns userIds/totalCount directly for immediate testing
        const mockResult = previewResult as unknown as {
          userIds?: string[];
          totalCount?: number;
        };
        if (isMockEnabled() && mockResult?.userIds) {
          opportunityPreview = {
            userIds: mockResult.userIds,
            totalCount: mockResult.totalCount || mockResult.userIds.length,
            status: OpportunityPreviewStatus.READY,
          };
        } else {
          opportunityPreview.status = OpportunityPreviewStatus.PENDING;
        }

        await ctx.con.getRepository(OpportunityJob).update(
          { id: opportunity.id },
          {
            flags: updateFlagsStatement<OpportunityJob>({
              preview: opportunityPreview,
            }),
          },
        );
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
              userIds: opportunityPreview.userIds.length
                ? opportunityPreview.userIds
                : ['nosuchid'],
            });
            return builder;
          },
          (nodes) => {
            // Sort nodes in JavaScript based on userIds order
            const userIdIndexMap = new Map(
              opportunityPreview.userIds.map((id, index) => [id, index]),
            );
            return nodes.sort((a, b) => {
              const indexA = userIdIndexMap.get(a.id) ?? Infinity;
              const indexB = userIdIndexMap.get(b.id) ?? Infinity;
              return indexA - indexB;
            });
          },
          true,
        );

      const flatTags = connection.edges.flatMap(({ node }) => {
        return node.topTags || [];
      });
      const uniqueTagsMap = flatTags.reduce(
        (acc, item) => {
          // map tags to how much they appear across all users
          if (typeof acc[item] === 'undefined') {
            acc[item] = 1;
          } else {
            acc[item] += 1;
          }

          return acc;
        },
        {} as Record<string, number>,
      );
      // final map and sort to get X tags that appear the most
      let tags = Object.entries(uniqueTagsMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 16)
        .map(([tag]) => tag);

      // In mock mode, use mock tags if no real tags found
      if (isMockEnabled() && tags.length === 0) {
        tags = mockPreviewTags;
      }

      const companies = getShowcaseCompanies();

      let squads = uniqueifyObjectArray(
        connection.edges.flatMap(({ node }) =>
          (node.activeSquads || []).map((squad) => squad),
        ),
        (squad) => squad.handle,
      );

      // In mock mode, use mock squads if no real squads found
      if (
        isMockEnabled() &&
        squads.length === 0 &&
        mockPreviewSquadIds.length
      ) {
        const mockSquads = await ctx.con.getRepository(Source).find({
          where: { id: In(mockPreviewSquadIds), type: SourceType.Squad },
        });
        squads = mockSquads.map((squad) => ({
          ...squad,
          public: !squad.private,
          members: undefined,
        }));
      }

      return {
        ...connection,
        result: {
          tags,
          companies,
          squads,
          totalCount: opportunityPreview.totalCount,
          status: opportunityPreview.status,
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
      const location = await findOrCreateDatasetLocation(
        con,
        preferences.data.externalLocationId,
      );

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
        OpportunityMatchStatus.CandidateReview,
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

      const file = await data.file;

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
      }: {
        id: string;
        payload: z.infer<typeof opportunityEditSchema>;
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
          recruiter,
          externalLocationId,
          locationType,
          ...opportunityUpdate
        } = opportunity;

        const opportunityContent = await renderOpportunityContent(content);

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

        await handleOpportunityLocationUpdate(
          entityManager,
          id,
          externalLocationId,
          locationType,
          ctx,
        );

        await handleOpportunityKeywordsUpdate(entityManager, id, keywords);

        await handleOpportunityScreeningQuestionsUpdate(
          entityManager,
          id,
          questions,
        );

        await handleOpportunityRecruiterUpdate(
          entityManager,
          id,
          recruiter,
          ctx,
        );
      });

      return await graphorm.queryOneOrFail<GQLOpportunity>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder.where({ id });

          return builder;
        },
      );
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
            locations: {
              location: true,
            },
          },
        });

      if (process.env.NODE_ENV === 'development') {
        return [];
      }

      const gondulClient = getGondulClient();

      const result = await gondulClient.garmr.execute(async () => {
        return await gondulClient.instance.screeningQuestions(
          new ScreeningQuestionsRequest({
            jobOpportunity: await createOpportunityPrompt({ opportunity }),
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

      const organization = await opportunity.organization;

      switch (state) {
        case OpportunityState.IN_REVIEW: {
          if (!organization) {
            throw new ConflictError(
              `Opportunity must have an organization assigned`,
            );
          }

          if (opportunity.state === OpportunityState.CLOSED) {
            throw new ConflictError(`Opportunity is closed`);
          }

          if (
            organization.recruiterSubscriptionFlags.status !==
            SubscriptionStatus.Active
          ) {
            throw new PaymentRequiredError(
              `Opportunity subscription is not active yet, make sure your payment was processed in full. Contact support if the issue persists.`,
            );
          }

          opportunityStateLiveSchema.parse({
            ...opportunity,
            organization: await opportunity.organization,
            keywords: await opportunity.keywords,
            questions: await opportunity.questions,
          });

          const liveOpportunities: Pick<OpportunityJob, 'flags'>[] =
            await ctx.con.getRepository(OpportunityJob).find({
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

          // look through live opportunities and decrement plan quantities
          // to figure out how many seats are left
          liveOpportunities.reduce((acc, opportunity) => {
            const planPriceId = opportunity.flags?.plan;

            const planForOpportunity = organizationPlans.find(
              (plan) => plan.priceId === planPriceId,
            );

            if (planForOpportunity) {
              planForOpportunity.quantity -= 1;
            }

            return acc;
          }, organizationPlans);

          // for now just assign first plan available
          const newPlan = organizationPlans.find((plan) => plan.quantity > 0);

          if (!newPlan) {
            throw new PaymentRequiredError(
              `Your don't have any more seats available. Please update your subscription to add more seats.`,
            );
          }

          await ctx.con.getRepository(OpportunityJob).update(
            { id },
            {
              state,
              flags: updateFlagsStatement<OpportunityJob>({
                plan: newPlan.priceId,
              }),
            },
          );

          break;
        }
        case OpportunityState.LIVE: {
          if (!ctx.isTeamMember) {
            throw new ConflictError('Invalid state transition');
          }

          await ctx.con.getRepository(OpportunityJob).update({ id }, { state });

          break;
        }
        case OpportunityState.CLOSED:
          if (opportunity.state !== OpportunityState.LIVE) {
            throw new ConflictError(`This opportunity is not live`);
          }

          const subscriptionid =
            organization.recruiterSubscriptionFlags.subscriptionId;

          if (!subscriptionid) {
            throw new ConflictError(`Opportunity subscription not found`);
          }

          await ctx.con.getRepository(OpportunityJob).update({ id }, { state });

          break;
        default:
          throw new ConflictError('Invalid state transition');
      }

      return {
        _: true,
      };
    },
    addOpportunitySeats: async (
      _,
      { id, payload }: { id: string; payload: unknown },
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const { seats } = addOpportunitySeatsSchema.parse(payload);

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
          },
        });

      const organization = await opportunity.organization;

      if (!organization) {
        throw new NotFoundError(
          'Opportunity must have organization to update subscription',
        );
      }

      const subscriptionid =
        organization.recruiterSubscriptionFlags.subscriptionId;

      if (!subscriptionid) {
        throw new ConflictError(`Opportunity subscription not found`);
      }

      const subscription =
        await paddleInstance.subscriptions.get(subscriptionid);

      const subscriptionItems = subscription.items.map((item) => {
        return {
          priceId: item.price.id,
          quantity: item.quantity,
        };
      }) as ISubscriptionUpdateItem[];

      seats.forEach((seat) => {
        const { priceId } = seat;

        // find the existing price item
        const priceItem = subscriptionItems.find(
          (item) => item.priceId === priceId,
        );

        const quantityToAdd = 1;

        // if not found, add new item with quantity 1, else increment quantity
        if (!priceItem) {
          subscriptionItems.push({ priceId, quantity: quantityToAdd });
        } else {
          priceItem.quantity += quantityToAdd;
        }
      });

      const updateResult = await paddleInstance.subscriptions.update(
        subscriptionid,
        {
          prorationBillingMode: 'prorated_immediately',
          items: subscriptionItems,
        },
      );

      await ctx.con.getRepository(Organization).update(organization.id, {
        recruiterSubscriptionFlags:
          updateRecruiterSubscriptionFlags<Organization>({
            items: updateResult.items.map((item) => {
              return {
                priceId: item.price.id,
                quantity: item.quantity,
              };
            }),
          }),
      });

      return { _: true };
    },
    createSharedSlackChannel: async (
      _,
      payload: z.infer<typeof createSharedSlackChannelSchema>,
      ctx: AuthContext,
    ): Promise<GQLEmptyResponse> => {
      const { organizationId, channelName, email } =
        createSharedSlackChannelSchema.parse(payload);

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

      // Verify user is a member of the organization
      const organizationMembership = await ctx.con
        .getRepository(ContentPreferenceOrganization)
        .findOne({
          where: {
            userId: ctx.userId,
            organizationId,
          },
        });

      if (!organizationMembership) {
        throw new ForbiddenError(
          'Access denied! You are not a member of this organization',
        );
      }

      // Get the organization and check subscription status
      const organization = await ctx.con
        .getRepository(Organization)
        .findOneOrFail({
          where: { id: organizationId },
        });

      // Check if organization has an active subscription
      if (
        organization.recruiterSubscriptionFlags.status !==
        SubscriptionStatus.Active
      ) {
        throw new PaymentRequiredError(
          'Your organization subscription is not active. Please ensure your payment has been processed before creating Slack channels.',
        );
      }

      // Check if organization already has a Slack connection
      if (organization.recruiterSubscriptionFlags.hasSlackConnection) {
        throw new ConflictError(
          'Your organization already has a Slack channel connection. Please contact support if you need to create a new channel.',
        );
      }

      try {
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

        // Mark organization as having a Slack connection and store channel name
        await ctx.con.getRepository(Organization).update(
          { id: organizationId },
          {
            recruiterSubscriptionFlags:
              updateRecruiterSubscriptionFlags<Organization>({
                hasSlackConnection: createResult.channel.name as string,
              }),
          },
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

      try {
        const startTime = Date.now();
        let stepStart = startTime;

        const parsedPayload = await parseOpportunitySchema.parseAsync(payload);
        ctx.log.info(
          { durationMs: Date.now() - stepStart },
          'parseOpportunity: payload schema validated',
        );

        stepStart = Date.now();
        const { buffer, extension } =
          await getOpportunityFileBuffer(parsedPayload);
        ctx.log.info(
          { durationMs: Date.now() - stepStart, bufferSize: buffer.length },
          'parseOpportunity: file buffer acquired',
        );

        stepStart = Date.now();
        const { mime } = await validateOpportunityFileType(buffer, extension);
        ctx.log.info(
          { durationMs: Date.now() - stepStart, mime },
          'parseOpportunity: file type validated',
        );

        stepStart = Date.now();
        const parsedData = await parseOpportunityWithBrokkr({
          buffer,
          mime,
          extension,
        });
        ctx.log.info(
          {
            durationMs: Date.now() - stepStart,
            title: parsedData.opportunity.title,
          },
          'parseOpportunity: Brokkr parsing completed',
        );

        stepStart = Date.now();
        const opportunity = await createOpportunityFromParsedData(
          {
            con: ctx.con,
            userId: ctx.userId,
            trackingId: ctx.trackingId,
            log: ctx.log,
          },
          parsedData,
        );
        ctx.log.info(
          { durationMs: Date.now() - stepStart, opportunityId: opportunity.id },
          'parseOpportunity: database records created',
        );

        const totalDurationMs = Date.now() - startTime;
        ctx.log.info(
          { totalDurationMs, opportunityId: opportunity.id },
          'parseOpportunity: completed successfully',
        );

        return graphorm.queryOneOrFail<GQLOpportunity>(ctx, info, (builder) => {
          builder.queryBuilder.where({ id: opportunity.id });
          return builder;
        });
      } catch (error) {
        ctx.log.error(
          { error },
          'parseOpportunity: failed to parse opportunity',
        );
        throw error;
      }
    },
    reimportOpportunity: async (
      _,
      {
        payload,
      }: {
        payload: unknown;
      },
      ctx: Context,
      info,
    ): Promise<GQLOpportunity> => {
      if (!ctx.userId) {
        throw new AuthenticationError('User must be authenticated');
      }

      try {
        const startTime = Date.now();
        let stepStart = startTime;

        const parsedPayload =
          await reimportOpportunitySchema.parseAsync(payload);
        ctx.log.info(
          {
            durationMs: Date.now() - stepStart,
            opportunityId: parsedPayload.opportunityId,
          },
          'reimportOpportunity: payload schema validated',
        );

        // Check user has permission to edit this opportunity
        stepStart = Date.now();
        await ensureOpportunityPermissions({
          con: ctx.con.manager,
          userId: ctx.userId,
          opportunityId: parsedPayload.opportunityId,
          permission: OpportunityPermissions.Edit,
          isTeamMember: ctx.isTeamMember,
        });
        ctx.log.info(
          { durationMs: Date.now() - stepStart },
          'reimportOpportunity: permissions verified',
        );

        stepStart = Date.now();
        const { buffer, extension } =
          await getOpportunityFileBuffer(parsedPayload);
        ctx.log.info(
          { durationMs: Date.now() - stepStart, bufferSize: buffer.length },
          'reimportOpportunity: file buffer acquired',
        );

        stepStart = Date.now();
        const { mime } = await validateOpportunityFileType(buffer, extension);
        ctx.log.info(
          { durationMs: Date.now() - stepStart, mime },
          'reimportOpportunity: file type validated',
        );

        stepStart = Date.now();
        const parsedData = await parseOpportunityWithBrokkr({
          buffer,
          mime,
          extension,
        });
        ctx.log.info(
          {
            durationMs: Date.now() - stepStart,
            title: parsedData.opportunity.title,
          },
          'reimportOpportunity: Brokkr parsing completed',
        );

        stepStart = Date.now();
        const opportunityId = await updateOpportunityFromParsedData(
          {
            con: ctx.con,
            log: ctx.log,
          },
          parsedPayload.opportunityId,
          parsedData,
        );
        ctx.log.info(
          { durationMs: Date.now() - stepStart, opportunityId },
          'reimportOpportunity: database records updated',
        );

        const totalDurationMs = Date.now() - startTime;
        ctx.log.info(
          { totalDurationMs, opportunityId },
          'reimportOpportunity: completed successfully',
        );

        return graphorm.queryOneOrFail<GQLOpportunity>(ctx, info, (builder) => {
          builder.queryBuilder.where({ id: opportunityId });
          return builder;
        });
      } catch (error) {
        ctx.log.error(
          { error },
          'reimportOpportunity: failed to reimport opportunity',
        );
        throw error;
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
