import type { ZodError } from 'zod';
import { DataSource, IsNull } from 'typeorm';
import request from 'supertest';
import { User, Keyword, Alerts } from '../../src/entity';
import { Opportunity } from '../../src/entity/opportunities/Opportunity';
import { OpportunityMatch } from '../../src/entity/OpportunityMatch';
import { Organization } from '../../src/entity/Organization';
import { OpportunityKeyword } from '../../src/entity/OpportunityKeyword';
import createOrGetConnection from '../../src/db';
import {
  authorizeRequest,
  createGarmrMock,
  createMockBrokkrTransport,
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testMutationErrorCode,
  testQueryErrorCode,
} from '../helpers';
import { keywordsFixture } from '../fixture/keywords';
import { usersFixture } from '../fixture';
import {
  opportunitiesFixture,
  opportunityKeywordsFixture,
  opportunityMatchesFixture,
  opportunityQuestionsFixture,
  opportunityFeedbackQuestionsFixture,
  organizationsFixture,
} from '../fixture/opportunity';
import {
  OpportunityUser,
  OpportunityUserRecruiter,
} from '../../src/entity/opportunities/user';
import {
  OpportunityMatchStatus,
  OpportunityUserType,
} from '../../src/entity/opportunities/types';
import {
  BrokkrService,
  CompanySize,
  CompanyStage,
  EmploymentType,
  LocationType,
  OpportunityState,
  SalaryPeriod,
  SeniorityLevel,
} from '@dailydotdev/schema';
import { UserCandidatePreference } from '../../src/entity/user/UserCandidatePreference';
import { QuestionScreening } from '../../src/entity/questions/QuestionScreening';
import type {
  GQLOpportunity,
  GQLOpportunityScreeningQuestion,
} from '../../src/schema/opportunity';
import { UserCandidateKeyword } from '../../src/entity/user/UserCandidateKeyword';
import * as googleCloud from '../../src/common/googleCloud';
import { Bucket } from '@google-cloud/storage';
import { deleteKeysByPattern, deleteRedisKey } from '../../src/redis';
import { rateLimiterName } from '../../src/directive/rateLimit';
import { fileTypeFromBuffer } from '../setup';
import {
  EMPLOYMENT_AGREEMENT_BUCKET_NAME,
  RESUME_BUCKET_NAME,
} from '../../src/config';
import { RoleType } from '../../src/common/schema/userCandidate';
import { QuestionType } from '../../src/entity/questions/types';
import { QuestionFeedback } from '../../src/entity/questions/QuestionFeedback';
import type { FastifyInstance } from 'fastify';
import type { Context } from '../../src/Context';
import { createMockGondulTransport } from '../helpers';
import { createClient } from '@connectrpc/connect';
import { ApplicationService as GondulService } from '@dailydotdev/schema';
import * as gondulModule from '../../src/common/gondul';
import type { ServiceClient } from '../../src/types';
import { OpportunityJob } from '../../src/entity/opportunities/OpportunityJob';
import * as brokkrCommon from '../../src/common/brokkr';
import { randomUUID } from 'node:crypto';

// Mock Slack WebClient
const mockConversationsCreate = jest.fn();
const mockConversationsInviteShared = jest.fn();
const mockConversationsJoin = jest.fn();

jest.mock('@slack/web-api', () => ({
  ...(jest.requireActual('@slack/web-api') as Record<string, unknown>),
  WebClient: jest.fn().mockImplementation(() => ({
    conversations: {
      get create() {
        return mockConversationsCreate;
      },
      get inviteShared() {
        return mockConversationsInviteShared;
      },
      get join() {
        return mockConversationsJoin;
      },
    },
  })),
}));

const deleteFileFromBucket = jest.spyOn(googleCloud, 'deleteFileFromBucket');
const uploadEmploymentAgreementFromBuffer = jest.spyOn(
  googleCloud,
  'uploadEmploymentAgreementFromBuffer',
);

let con: DataSource;
let app: FastifyInstance;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string | null = null;
let isTeamMember = false;
let trackingId: string | undefined = undefined;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    (req) =>
      new MockContext(
        con,
        loggedUser || undefined,
        [],
        req,
        isTeamMember,
        undefined,
        undefined,
        trackingId,
      ) as Context,
  );
  client = state.client;
  app = state.app;
});

afterAll(() => disposeGraphQLTesting(state));

beforeEach(async () => {
  loggedUser = null;

  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Keyword, keywordsFixture);
  await saveFixtures(con, Organization, organizationsFixture);
  await saveFixtures(con, Opportunity, opportunitiesFixture);
  await saveFixtures(con, QuestionScreening, opportunityQuestionsFixture);
  await saveFixtures(
    con,
    QuestionFeedback,
    opportunityFeedbackQuestionsFixture,
  );
  await saveFixtures(con, OpportunityKeyword, opportunityKeywordsFixture);
  await saveFixtures(con, OpportunityMatch, opportunityMatchesFixture);
  await saveFixtures(con, OpportunityUser, [
    {
      opportunityId: opportunitiesFixture[0].id,
      userId: usersFixture[0].id,
      type: OpportunityUserType.Recruiter,
    },
    {
      opportunityId: opportunitiesFixture[0].id,
      userId: usersFixture[1].id,
      // @ts-expect-error no other type is defined but we're testing filtering
      type: 'other',
    },
    {
      opportunityId: opportunitiesFixture[1].id,
      userId: usersFixture[1].id,
      type: OpportunityUserType.Recruiter,
    },
    {
      opportunityId: opportunitiesFixture[2].id,
      userId: usersFixture[0].id,
      type: OpportunityUserType.Recruiter,
    },
    {
      opportunityId: opportunitiesFixture[3].id,
      userId: usersFixture[1].id,
      type: OpportunityUserType.Recruiter,
    },
  ]);
});

describe('query opportunityById', () => {
  const OPPORTUNITY_BY_ID_QUERY = /* GraphQL */ `
    query OpportunityById($id: ID!) {
      opportunityById(id: $id) {
        id
        type
        state
        title
        tldr
        content {
          overview {
            content
            html
          }
        }
        meta {
          roleType
          teamSize
          seniorityLevel
          employmentType
          salary {
            min
            max
            period
          }
          equity
        }
        location {
          city
          country
          type
        }
        organization {
          id
          name
          image
          website
          description
          location
          customLinks {
            ...Link
          }
          socialLinks {
            ...Link
          }
          pressLinks {
            ...Link
          }
        }
        recruiters {
          id
        }
        keywords {
          keyword
        }
        questions {
          id
          title
          order
          placeholder
          opportunityId
        }
        feedbackQuestions {
          id
          title
          order
          placeholder
          opportunityId
        }
      }
    }

    fragment Link on OrganizationLink {
      type
      socialType
      title
      link
    }
  `;

  it('should return opportunity by id', async () => {
    const res = await client.query<
      { opportunityById: GQLOpportunity },
      { id: string }
    >(OPPORTUNITY_BY_ID_QUERY, {
      variables: { id: '550e8400-e29b-41d4-a716-446655440001' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.opportunityById).toEqual({
      id: '550e8400-e29b-41d4-a716-446655440001',
      type: 1,
      state: 2,
      title: 'Senior Full Stack Developer',
      tldr: 'Join our team as a Senior Full Stack Developer',
      content: {
        overview: {
          content: 'We are looking for a Senior Full Stack Developer...',
          html: '<p>We are looking for a Senior Full Stack Developer...</p>',
        },
      },
      meta: {
        roleType: 0.0,
        teamSize: 10,
        seniorityLevel: 4,
        employmentType: 1,
        salary: {
          min: 60000,
          max: 120000,
          period: 1,
        },
        equity: true,
      },
      location: [
        {
          city: null,
          country: 'Norway',
          type: 1,
        },
      ],
      organization: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Daily Dev Inc',
        image: 'https://example.com/logo.png',
        website: 'https://daily.dev',
        description: 'A platform for developers',
        location: 'San Francisco',
        customLinks: [
          {
            type: 'custom',
            title: 'Custom Link',
            link: 'https://custom.link',
            socialType: null,
          },
          {
            type: 'custom',
            title: 'Custom Link 2',
            link: 'https://custom2.link',
            socialType: null,
          },
        ],
        socialLinks: [
          {
            type: 'social',
            socialType: 'facebook',
            title: null,
            link: 'https://facebook.com',
          },
        ],
        pressLinks: [
          {
            type: 'press',
            title: 'Press link',
            link: 'https://press.link',
            socialType: null,
          },
        ],
      },
      recruiters: [{ id: '1' }],
      keywords: expect.arrayContaining([
        { keyword: 'webdev' },
        { keyword: 'fullstack' },
        { keyword: 'Fortune 500' },
      ]),
      questions: expect.arrayContaining([
        {
          id: '750e8400-e29b-41d4-a716-446655440001',
          title: 'What is your favorite programming language?',
          placeholder: 'e.g., JavaScript, Python, etc.',
          opportunityId: '550e8400-e29b-41d4-a716-446655440001',
          order: 1,
        },
        {
          id: '750e8400-e29b-41d4-a716-446655440002',
          title: 'Describe a challenging project you worked on.',
          placeholder: 'Your answer here...',
          opportunityId: '550e8400-e29b-41d4-a716-446655440001',
          order: 0,
        },
      ]),
      feedbackQuestions: expect.arrayContaining([
        {
          id: '850e8400-e29b-41d4-a716-446655440001',
          title: 'How did you hear about this opportunity?',
          placeholder: 'e.g., LinkedIn, friend, etc.',
          opportunityId: '550e8400-e29b-41d4-a716-446655440001',
          order: 0,
        },
        {
          id: '850e8400-e29b-41d4-a716-446655440002',
          title: 'What interests you most about this role?',
          placeholder: 'Your answer here...',
          opportunityId: '550e8400-e29b-41d4-a716-446655440001',
          order: 1,
        },
      ]),
    });
  });

  it('should correctly separate screening and feedback questions by type', async () => {
    // This test ensures that questions and feedbackQuestions
    // are properly filtered by their type discriminator
    const res = await client.query<
      { opportunityById: GQLOpportunity },
      { id: string }
    >(OPPORTUNITY_BY_ID_QUERY, {
      variables: { id: '550e8400-e29b-41d4-a716-446655440001' },
    });

    expect(res.errors).toBeFalsy();

    // Verify screening questions only contain screening type (IDs starting with 750e)
    expect(res.data.opportunityById.questions).toHaveLength(2);
    expect(
      res.data.opportunityById.questions.every((q) => q.id.startsWith('750e')),
    ).toBe(true);

    // Verify feedback questions only contain feedback type (IDs starting with 850e)
    expect(res.data.opportunityById.feedbackQuestions).toHaveLength(2);
    expect(
      res.data.opportunityById.feedbackQuestions.every((q) =>
        q.id.startsWith('850e'),
      ),
    ).toBe(true);

    // Verify no overlap - screening questions should not appear in feedback
    const screeningIds = res.data.opportunityById.questions.map((q) => q.id);
    const feedbackIds = res.data.opportunityById.feedbackQuestions.map(
      (q) => q.id,
    );
    const hasOverlap = screeningIds.some((id) => feedbackIds.includes(id));
    expect(hasOverlap).toBe(false);
  });

  it('should return UNEXPECTED for false UUID opportunity', async () => {
    await testQueryErrorCode(
      client,
      { query: OPPORTUNITY_BY_ID_QUERY, variables: { id: 'non-existing' } },
      'UNEXPECTED',
    );
  });

  it('should return null for non-live opportunity when user is not a recruiter', async () => {
    loggedUser = '2';

    await con
      .getRepository(Opportunity)
      .update(
        { id: '550e8400-e29b-41d4-a716-446655440001' },
        { state: OpportunityState.DRAFT },
      );

    await testQueryErrorCode(
      client,
      {
        query: OPPORTUNITY_BY_ID_QUERY,
        variables: { id: '550e8400-e29b-41d4-a716-446655440001' },
      },
      'FORBIDDEN',
    );
  });

  it('should return null for not existing opportunity', async () => {
    await testQueryErrorCode(
      client,
      {
        query: OPPORTUNITY_BY_ID_QUERY,
        variables: { id: '660e8400-e29b-41d4-a716-446655440000' },
      },
      'NOT_FOUND',
    );
  });

  it('should return non-live opportunity if user is a recruiter', async () => {
    loggedUser = '3';

    await con.getRepository(OpportunityUser).save({
      userId: '3',
      opportunityId: '550e8400-e29b-41d4-a716-446655440003',
      type: OpportunityUserType.Recruiter,
    });

    const res = await client.query(OPPORTUNITY_BY_ID_QUERY, {
      variables: { id: '550e8400-e29b-41d4-a716-446655440003' },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data.opportunityById.id).toEqual(
      '550e8400-e29b-41d4-a716-446655440003',
    );
  });

  it('should return non-live opportunity if user is a team member', async () => {
    loggedUser = '2';
    isTeamMember = true;

    const res = await client.query(OPPORTUNITY_BY_ID_QUERY, {
      variables: { id: '550e8400-e29b-41d4-a716-446655440004' },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data.opportunityById.id).toEqual(
      '550e8400-e29b-41d4-a716-446655440004',
    );

    isTeamMember = false;
  });
});

describe('query opportunities', () => {
  const GET_OPPORTUNITIES_QUERY = /* GraphQL */ `
    query GetOpportunities(
      $state: ProtoEnumValue
      $first: Int
      $after: String
    ) {
      opportunities(state: $state, first: $first, after: $after) {
        pageInfo {
          hasNextPage
          hasPreviousPage
          endCursor
          startCursor
        }
        edges {
          node {
            id
            title
            state
          }
        }
      }
    }
  `;

  beforeEach(async () => {
    // Ensure user 1 is a recruiter for 3 opportunities total
    // (already has opportunities[0] and opportunities[2] from beforeEach)
    await saveFixtures(con, OpportunityUser, [
      {
        opportunityId: opportunitiesFixture[1].id, // Third LIVE opportunity
        userId: usersFixture[0].id, // User '1'
        type: OpportunityUserType.Recruiter,
      },
      {
        opportunityId: opportunitiesFixture[4].id, // Third LIVE opportunity
        userId: usersFixture[0].id, // User '1'
        type: OpportunityUserType.Recruiter,
      },
    ]);
  });

  it('should throw error if not authenticated', async () => {
    await testQueryErrorCode(
      client,
      {
        query: GET_OPPORTUNITIES_QUERY,
      },
      'UNAUTHENTICATED',
    );
  });

  it('should return all LIVE opportunities with authentication', async () => {
    loggedUser = '1';

    const res = await client.query(GET_OPPORTUNITIES_QUERY, {
      variables: { state: OpportunityState.LIVE, first: 10 },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.opportunities.edges).toHaveLength(3);
    expect(res.data.opportunities.pageInfo.hasNextPage).toBe(false);
  });

  it('should return only recruiter DRAFT opportunities for authenticated non-team member', async () => {
    loggedUser = '1';

    const res = await client.query(GET_OPPORTUNITIES_QUERY, {
      variables: { state: OpportunityState.DRAFT, first: 10 },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.opportunities.edges).toHaveLength(1);
    expect(res.data.opportunities.edges[0].node).toEqual(
      expect.objectContaining({
        id: '550e8400-e29b-41d4-a716-446655440003',
        state: OpportunityState.DRAFT,
      }),
    );
  });

  it('should return correct DRAFT opportunities for different recruiter', async () => {
    loggedUser = '2';

    const res = await client.query(GET_OPPORTUNITIES_QUERY, {
      variables: { state: OpportunityState.DRAFT, first: 10 },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.opportunities.edges).toHaveLength(1);
    expect(res.data.opportunities.edges[0].node).toEqual(
      expect.objectContaining({
        id: '550e8400-e29b-41d4-a716-446655440004',
        state: OpportunityState.DRAFT,
      }),
    );
  });

  it('should return all DRAFT opportunities for team members', async () => {
    loggedUser = '1';
    isTeamMember = true;

    const res = await client.query(GET_OPPORTUNITIES_QUERY, {
      variables: { state: OpportunityState.DRAFT, first: 10 },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.opportunities.edges).toHaveLength(2);
    const nodes = res.data.opportunities.edges.map(
      (e: { node: unknown }) => e.node,
    );
    expect(nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: '550e8400-e29b-41d4-a716-446655440003',
          state: OpportunityState.DRAFT,
        }),
        expect.objectContaining({
          id: '550e8400-e29b-41d4-a716-446655440004',
          state: OpportunityState.DRAFT,
        }),
      ]),
    );

    isTeamMember = false;
  });

  it('should support pagination with first parameter', async () => {
    loggedUser = '1';

    const res = await client.query(GET_OPPORTUNITIES_QUERY, {
      variables: { state: OpportunityState.LIVE, first: 2 },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.opportunities.edges).toHaveLength(2);
    expect(res.data.opportunities.pageInfo.hasNextPage).toBe(true);
    expect(res.data.opportunities.pageInfo.endCursor).toBeTruthy();
  });

  it('should support pagination with after cursor', async () => {
    loggedUser = '1';

    // Get first page
    const firstPage = await client.query(GET_OPPORTUNITIES_QUERY, {
      variables: { state: OpportunityState.LIVE, first: 2 },
    });

    expect(firstPage.errors).toBeFalsy();
    const endCursor = firstPage.data.opportunities.pageInfo.endCursor;

    // Get second page
    const secondPage = await client.query(GET_OPPORTUNITIES_QUERY, {
      variables: { state: OpportunityState.LIVE, first: 2, after: endCursor },
    });

    expect(secondPage.errors).toBeFalsy();
    expect(secondPage.data.opportunities.edges).toHaveLength(1);
    expect(secondPage.data.opportunities.pageInfo.hasNextPage).toBe(false);
    expect(secondPage.data.opportunities.pageInfo.hasPreviousPage).toBe(true);
  });
});

describe('query getOpportunityMatch', () => {
  const GET_OPPORTUNITY_MATCH_QUERY = /* GraphQL */ `
    query GetOpportunityMatch($id: ID!) {
      getOpportunityMatch(id: $id) {
        status
        description {
          reasoning
        }
      }
    }
  `;

  it('should return opportunity match for authenticated user', async () => {
    loggedUser = '1';

    const res = await client.query(GET_OPPORTUNITY_MATCH_QUERY, {
      variables: { id: '550e8400-e29b-41d4-a716-446655440001' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.getOpportunityMatch).toEqual({
      status: 'pending',
      description: {
        reasoning: 'Interested candidate',
      },
    });
  });

  it('should not clear alert when alert does not match opportunityId', async () => {
    loggedUser = '1';

    await saveFixtures(con, Alerts, [
      {
        userId: '1',
        opportunityId: '550e8400-e29b-41d4-a716-446655440002',
      },
    ]);

    const res = await client.query(GET_OPPORTUNITY_MATCH_QUERY, {
      variables: { id: '550e8400-e29b-41d4-a716-446655440001' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.getOpportunityMatch).toEqual({
      status: 'pending',
      description: {
        reasoning: 'Interested candidate',
      },
    });
    expect(
      await con.getRepository(Alerts).countBy({
        userId: '1',
        opportunityId: '550e8400-e29b-41d4-a716-446655440002',
      }),
    ).toEqual(1);
    expect(
      await con
        .getRepository(Alerts)
        .countBy({ userId: '1', opportunityId: IsNull() }),
    ).toEqual(0);
  });

  it('should return different match for different user', async () => {
    loggedUser = '2';

    const res = await client.query(GET_OPPORTUNITY_MATCH_QUERY, {
      variables: { id: '550e8400-e29b-41d4-a716-446655440001' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.getOpportunityMatch).toEqual({
      status: 'candidate_accepted',
      description: {
        reasoning: 'Accepted candidate',
      },
    });
  });

  it('should require authentication', async () => {
    await testQueryErrorCode(
      client,
      {
        query: GET_OPPORTUNITY_MATCH_QUERY,
        variables: { id: '550e8400-e29b-41d4-a716-446655440001' },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should return null for non-existent match', async () => {
    loggedUser = '1';

    await testQueryErrorCode(
      client,
      {
        query: GET_OPPORTUNITY_MATCH_QUERY,
        variables: { id: '770e8400-e29b-41d4-a716-446655440001' },
      },
      'NOT_FOUND',
    );
  });

  it('should return null when user has no match for opportunity', async () => {
    loggedUser = '3';

    await testQueryErrorCode(
      client,
      {
        query: GET_OPPORTUNITY_MATCH_QUERY,
        variables: { id: '550e8400-e29b-41d4-a716-446655440002' },
      },
      'NOT_FOUND',
    );
  });
});

describe('query opportunityMatches', () => {
  const GET_OPPORTUNITY_MATCHES_QUERY = /* GraphQL */ `
    query GetOpportunityMatches(
      $opportunityId: ID!
      $first: Int
      $after: String
    ) {
      opportunityMatches(
        opportunityId: $opportunityId
        first: $first
        after: $after
      ) {
        pageInfo {
          hasNextPage
          hasPreviousPage
          endCursor
          startCursor
        }
        edges {
          node {
            userId
            opportunityId
            status
            description {
              reasoning
            }
            screening {
              screening
              answer
            }
            feedback {
              screening
              answer
            }
            applicationRank {
              score
              description
              warmIntro
            }
            user {
              id
              name
            }
            candidatePreferences {
              status
              role
            }
            createdAt
            updatedAt
          }
        }
      }
    }
  `;

  beforeEach(async () => {
    // Add recruiter permission for user 1 on opportunity 1
    await saveFixtures(con, OpportunityUser, [
      {
        opportunityId: opportunitiesFixture[0].id,
        userId: usersFixture[0].id,
        type: OpportunityUserType.Recruiter,
      },
    ]);

    // Add candidate preferences for users 2 and 4
    await saveFixtures(con, UserCandidatePreference, [
      {
        userId: usersFixture[1].id,
        status: 1, // Active
        role: 'Senior Developer',
      },
      {
        userId: '4',
        status: 1, // Active
        role: 'Principal Engineer',
      },
    ]);
  });

  it('should return only candidate_accepted, recruiter_accepted, and recruiter_rejected matches', async () => {
    loggedUser = '1';

    const res = await client.query(GET_OPPORTUNITY_MATCHES_QUERY, {
      variables: {
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        first: 10,
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.opportunityMatches.edges).toHaveLength(3);

    const statuses = res.data.opportunityMatches.edges.map(
      (e: { node: { status: string } }) => e.node.status,
    );

    // Should include these statuses
    expect(statuses).toContain('candidate_accepted');
    expect(statuses).toContain('recruiter_accepted');
    expect(statuses).toContain('recruiter_rejected');

    // Should NOT include these statuses
    expect(statuses).not.toContain('pending');
    expect(statuses).not.toContain('candidate_rejected');
    expect(statuses).not.toContain('candidate_time_out');
  });

  it('should include user data and candidate preferences', async () => {
    loggedUser = '1';

    const res = await client.query(GET_OPPORTUNITY_MATCHES_QUERY, {
      variables: {
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        first: 10,
      },
    });

    expect(res.errors).toBeFalsy();

    const acceptedMatch = res.data.opportunityMatches.edges.find(
      (e: { node: { status: string } }) =>
        e.node.status === 'candidate_accepted',
    );

    expect(acceptedMatch.node.user).toEqual({
      id: '2',
      name: 'Tsahi',
    });

    expect(acceptedMatch.node.candidatePreferences).toEqual({
      status: 1,
      role: 'Senior Developer',
    });
  });

  it('should include screening, feedback, and application rank', async () => {
    loggedUser = '1';

    const res = await client.query(GET_OPPORTUNITY_MATCHES_QUERY, {
      variables: {
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        first: 10,
      },
    });

    expect(res.errors).toBeFalsy();

    const acceptedMatch = res.data.opportunityMatches.edges.find(
      (e: { node: { status: string } }) =>
        e.node.status === 'candidate_accepted',
    );

    expect(acceptedMatch.node.screening).toEqual([
      { screening: 'What is your favorite language?', answer: 'JavaScript' },
    ]);

    expect(acceptedMatch.node.feedback).toEqual([
      { screening: 'How did you hear about us?', answer: 'LinkedIn' },
    ]);

    expect(acceptedMatch.node.applicationRank).toEqual({
      score: 90,
      description: 'Excellent fit',
      warmIntro: 'Great background in React',
    });
  });

  it('should support pagination with first parameter', async () => {
    loggedUser = '1';

    const res = await client.query(GET_OPPORTUNITY_MATCHES_QUERY, {
      variables: {
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        first: 2,
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.opportunityMatches.edges).toHaveLength(2);
    expect(res.data.opportunityMatches.pageInfo.hasNextPage).toBe(true);
    expect(res.data.opportunityMatches.pageInfo.endCursor).toBeTruthy();
  });

  it('should support pagination with after cursor', async () => {
    loggedUser = '1';

    // Get first page
    const firstPage = await client.query(GET_OPPORTUNITY_MATCHES_QUERY, {
      variables: {
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        first: 2,
      },
    });

    expect(firstPage.errors).toBeFalsy();
    expect(firstPage.data.opportunityMatches.edges).toHaveLength(2);
    expect(firstPage.data.opportunityMatches.pageInfo.hasNextPage).toBe(true);
    const firstUserIds = firstPage.data.opportunityMatches.edges.map(
      (e: { node: { userId: string } }) => e.node.userId,
    );
    const endCursor = firstPage.data.opportunityMatches.pageInfo.endCursor;

    // Get second page
    const secondPage = await client.query(GET_OPPORTUNITY_MATCHES_QUERY, {
      variables: {
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        first: 10,
        after: endCursor,
      },
    });

    expect(secondPage.errors).toBeFalsy();
    expect(secondPage.data.opportunityMatches.edges).toHaveLength(1);
    expect(secondPage.data.opportunityMatches.pageInfo.hasNextPage).toBe(false);
    // Verify we got different results
    expect(firstUserIds).not.toContain(
      secondPage.data.opportunityMatches.edges[0].node.userId,
    );
    expect(secondPage.data.opportunityMatches.pageInfo.hasPreviousPage).toBe(
      true,
    );
  });

  it('should require authentication', async () => {
    await testQueryErrorCode(
      client,
      {
        query: GET_OPPORTUNITY_MATCHES_QUERY,
        variables: {
          opportunityId: '550e8400-e29b-41d4-a716-446655440001',
          first: 10,
        },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should require permission to view opportunity', async () => {
    loggedUser = '3'; // User without permission

    await testQueryErrorCode(
      client,
      {
        query: GET_OPPORTUNITY_MATCHES_QUERY,
        variables: {
          opportunityId: '550e8400-e29b-41d4-a716-446655440001',
          first: 10,
        },
      },
      'FORBIDDEN',
    );
  });

  it('should return empty list for opportunity with no non-pending matches', async () => {
    loggedUser = '1';

    // Add permission for opportunity 3
    await saveFixtures(con, OpportunityUser, [
      {
        opportunityId: opportunitiesFixture[2].id,
        userId: usersFixture[0].id,
        type: OpportunityUserType.Recruiter,
      },
    ]);

    const res = await client.query(GET_OPPORTUNITY_MATCHES_QUERY, {
      variables: {
        opportunityId: '550e8400-e29b-41d4-a716-446655440003',
        first: 10,
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.opportunityMatches.edges).toHaveLength(0);
    expect(res.data.opportunityMatches.pageInfo.hasNextPage).toBe(false);
  });

  it('should not expose salaryExpectation to recruiters viewing other candidates', async () => {
    loggedUser = '1'; // Recruiter

    // Add salaryExpectation to user 2's candidate preferences
    await con.getRepository(UserCandidatePreference).update(
      { userId: usersFixture[1].id },
      {
        salaryExpectation: {
          min: 120000,
          period: SalaryPeriod.ANNUALLY,
        },
      },
    );

    const GET_OPPORTUNITY_MATCHES_WITH_SALARY_QUERY = /* GraphQL */ `
      query GetOpportunityMatchesWithSalary($opportunityId: ID!, $first: Int) {
        opportunityMatches(opportunityId: $opportunityId, first: $first) {
          edges {
            node {
              userId
              updatedAt
              candidatePreferences {
                status
                role
                salaryExpectation {
                  min
                  period
                }
              }
            }
          }
        }
      }
    `;

    const res = await client.query(GET_OPPORTUNITY_MATCHES_WITH_SALARY_QUERY, {
      variables: {
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        first: 10,
      },
    });

    expect(res.errors).toBeFalsy();

    // Find the match for user 2 (candidate with salaryExpectation)
    const user2Match = res.data.opportunityMatches.edges.find(
      (e: { node: { userId: string } }) => e.node.userId === '2',
    );

    expect(user2Match).toBeDefined();
    expect(user2Match.node.candidatePreferences.role).toBe('Senior Developer');
    // salaryExpectation should be null for recruiter viewing another candidate
    expect(user2Match.node.candidatePreferences.salaryExpectation).toBeNull();
  });
});

describe('query userOpportunityMatches', () => {
  const GET_USER_OPPORTUNITY_MATCHES_QUERY = /* GraphQL */ `
    query GetUserOpportunityMatches($first: Int, $after: String) {
      userOpportunityMatches(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          hasPreviousPage
          endCursor
          startCursor
        }
        edges {
          node {
            userId
            opportunityId
            status
            description {
              reasoning
            }
            screening {
              screening
              answer
            }
            feedback {
              screening
              answer
            }
            applicationRank {
              score
              description
              warmIntro
            }
            user {
              id
              name
            }
            candidatePreferences {
              status
              role
            }
            createdAt
            updatedAt
          }
        }
      }
    }
  `;

  it('should require authentication', async () => {
    await testQueryErrorCode(
      client,
      {
        query: GET_USER_OPPORTUNITY_MATCHES_QUERY,
        variables: {
          first: 10,
        },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should return all matches for the authenticated user', async () => {
    loggedUser = '1';

    const res = await client.query(GET_USER_OPPORTUNITY_MATCHES_QUERY, {
      variables: {
        first: 10,
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userOpportunityMatches.edges).toHaveLength(2);

    const opportunityIds = res.data.userOpportunityMatches.edges.map(
      (e: { node: { opportunityId: string } }) => e.node.opportunityId,
    );

    // User 1 has matches for opportunities 1 and 3
    expect(opportunityIds).toContain('550e8400-e29b-41d4-a716-446655440001');
    expect(opportunityIds).toContain('550e8400-e29b-41d4-a716-446655440003');

    // All matches should belong to user 1
    const userIds = res.data.userOpportunityMatches.edges.map(
      (e: { node: { userId: string } }) => e.node.userId,
    );
    expect(userIds.every((id: string) => id === '1')).toBe(true);
  });

  it('should return matches ordered by updatedAt DESC', async () => {
    loggedUser = '2';

    // Add more matches for user 2 with different updatedAt dates
    await saveFixtures(con, OpportunityMatch, [
      {
        opportunityId: '550e8400-e29b-41d4-a716-446655440002',
        userId: '2',
        status: OpportunityMatchStatus.Pending,
        description: { reasoning: 'Newer match' },
        screening: [],
        feedback: [],
        applicationRank: {},
        createdAt: new Date('2023-01-10'),
        updatedAt: new Date('2023-01-10'),
      },
    ]);

    const res = await client.query(GET_USER_OPPORTUNITY_MATCHES_QUERY, {
      variables: {
        first: 10,
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userOpportunityMatches.edges).toHaveLength(2);

    const updatedDates = res.data.userOpportunityMatches.edges.map(
      (e: { node: { updatedAt: string } }) => new Date(e.node.updatedAt),
    );

    // Verify DESC ordering (most recent first)
    expect(updatedDates[0].getTime()).toBeGreaterThan(
      updatedDates[1].getTime(),
    );
  });

  it('should return different matches for different users', async () => {
    loggedUser = '2';

    const res = await client.query(GET_USER_OPPORTUNITY_MATCHES_QUERY, {
      variables: {
        first: 10,
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userOpportunityMatches.edges).toHaveLength(1);

    const match = res.data.userOpportunityMatches.edges[0].node;
    expect(match.userId).toBe('2');
    expect(match.opportunityId).toBe('550e8400-e29b-41d4-a716-446655440001');
    expect(match.status).toBe('candidate_accepted');
    expect(match.description.reasoning).toBe('Accepted candidate');
  });

  it('should include all match statuses for the user', async () => {
    loggedUser = '1';

    const res = await client.query(GET_USER_OPPORTUNITY_MATCHES_QUERY, {
      variables: {
        first: 10,
      },
    });

    expect(res.errors).toBeFalsy();

    const statuses = res.data.userOpportunityMatches.edges.map(
      (e: { node: { status: string } }) => e.node.status,
    );

    // User 1 has two pending matches
    expect(statuses).toContain('pending');
  });

  it('should include screening, feedback, and application rank data', async () => {
    loggedUser = '1';

    const res = await client.query(GET_USER_OPPORTUNITY_MATCHES_QUERY, {
      variables: {
        first: 10,
      },
    });

    expect(res.errors).toBeFalsy();

    const matchWithData = res.data.userOpportunityMatches.edges.find(
      (e: { node: { opportunityId: string } }) =>
        e.node.opportunityId === '550e8400-e29b-41d4-a716-446655440001',
    );

    expect(matchWithData.node.screening).toEqual([
      { screening: 'What is your favorite language?', answer: 'TypeScript' },
    ]);

    expect(matchWithData.node.applicationRank).toEqual({
      score: 85,
      description: 'Strong candidate',
      warmIntro: null,
    });
  });

  it('should support pagination with first parameter', async () => {
    loggedUser = '1';

    const res = await client.query(GET_USER_OPPORTUNITY_MATCHES_QUERY, {
      variables: {
        first: 1,
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userOpportunityMatches.edges).toHaveLength(1);
    expect(res.data.userOpportunityMatches.pageInfo.hasNextPage).toBe(true);
    expect(res.data.userOpportunityMatches.pageInfo.endCursor).toBeTruthy();
  });

  it('should support pagination with after cursor', async () => {
    loggedUser = '1';

    // Update one match to have a different updatedAt for proper pagination testing
    await con.getRepository(OpportunityMatch).update(
      {
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        userId: '1',
      },
      {
        updatedAt: new Date('2023-01-08'),
      },
    );

    // Get first page
    const firstPage = await client.query(GET_USER_OPPORTUNITY_MATCHES_QUERY, {
      variables: {
        first: 1,
      },
    });

    expect(firstPage.errors).toBeFalsy();
    expect(firstPage.data.userOpportunityMatches.edges).toHaveLength(1);
    expect(firstPage.data.userOpportunityMatches.pageInfo.hasNextPage).toBe(
      true,
    );
    const firstOpportunityId =
      firstPage.data.userOpportunityMatches.edges[0].node.opportunityId;
    const endCursor = firstPage.data.userOpportunityMatches.pageInfo.endCursor;

    // Get second page
    const secondPage = await client.query(GET_USER_OPPORTUNITY_MATCHES_QUERY, {
      variables: {
        first: 10,
        after: endCursor,
      },
    });

    expect(secondPage.errors).toBeFalsy();
    expect(secondPage.data.userOpportunityMatches.edges).toHaveLength(1);
    expect(secondPage.data.userOpportunityMatches.pageInfo.hasNextPage).toBe(
      false,
    );
    // Verify we got different results
    expect(
      secondPage.data.userOpportunityMatches.edges[0].node.opportunityId,
    ).not.toBe(firstOpportunityId);
    expect(
      secondPage.data.userOpportunityMatches.pageInfo.hasPreviousPage,
    ).toBe(true);
  });

  it('should return empty list for user with no matches', async () => {
    loggedUser = '5'; // User with no matches

    const res = await client.query(GET_USER_OPPORTUNITY_MATCHES_QUERY, {
      variables: {
        first: 10,
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userOpportunityMatches.edges).toHaveLength(0);
    expect(res.data.userOpportunityMatches.pageInfo.hasNextPage).toBe(false);
  });

  it('should include user data in the response', async () => {
    loggedUser = '1';

    const res = await client.query(GET_USER_OPPORTUNITY_MATCHES_QUERY, {
      variables: {
        first: 10,
      },
    });

    expect(res.errors).toBeFalsy();

    const firstMatch = res.data.userOpportunityMatches.edges[0].node;
    expect(firstMatch.user).toEqual({
      id: '1',
      name: 'Ido',
    });
  });

  it('should expose salaryExpectation to user viewing their own matches', async () => {
    loggedUser = '1';

    // Add salaryExpectation to user 1's candidate preferences
    await con.getRepository(UserCandidatePreference).upsert(
      {
        userId: '1',
        salaryExpectation: {
          min: 100000,
          period: SalaryPeriod.ANNUAL,
        },
      },
      {
        conflictPaths: ['userId'],
        skipUpdateIfNoValuesChanged: true,
      },
    );

    const GET_USER_MATCHES_WITH_SALARY_QUERY = /* GraphQL */ `
      query GetUserOpportunityMatchesWithSalary($first: Int) {
        userOpportunityMatches(first: $first) {
          edges {
            node {
              userId
              updatedAt
              candidatePreferences {
                status
                role
                salaryExpectation {
                  min
                  period
                }
              }
            }
          }
        }
      }
    `;

    const res = await client.query(GET_USER_MATCHES_WITH_SALARY_QUERY, {
      variables: {
        first: 10,
      },
    });

    expect(res.errors).toBeFalsy();

    const firstMatch = res.data.userOpportunityMatches.edges[0].node;
    expect(firstMatch.userId).toBe('1');
    expect(firstMatch.candidatePreferences.salaryExpectation).toEqual({
      min: 100000,
      period: 1, // ANNUAL
    });
  });

  it('should include opportunity details when requested', async () => {
    loggedUser = '1';

    const GET_USER_MATCHES_WITH_OPPORTUNITY_QUERY = /* GraphQL */ `
      query GetUserOpportunityMatchesWithOpportunity($first: Int) {
        userOpportunityMatches(first: $first) {
          edges {
            node {
              userId
              opportunityId
              status
              updatedAt
              opportunity {
                id
                title
                state
                location {
                  city
                  country
                }
                organization {
                  id
                  name
                }
              }
            }
          }
        }
      }
    `;

    const res = await client.query(GET_USER_MATCHES_WITH_OPPORTUNITY_QUERY, {
      variables: {
        first: 10,
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userOpportunityMatches.edges).toHaveLength(2);

    const matchWithOpportunity = res.data.userOpportunityMatches.edges.find(
      (e: { node: { opportunityId: string } }) =>
        e.node.opportunityId === '550e8400-e29b-41d4-a716-446655440001',
    );

    expect(matchWithOpportunity.node.opportunity).toEqual({
      id: '550e8400-e29b-41d4-a716-446655440001',
      title: 'Senior Full Stack Developer',
      state: 2, // LIVE
      location: [
        {
          city: null,
          country: 'Norway',
        },
      ],
      organization: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Daily Dev Inc',
      },
    });
  });
});

describe('query getCandidatePreferences', () => {
  const QUERY = /* GraphQL */ `
    query GetCandidatePreferences {
      getCandidatePreferences {
        status
        cv {
          fileName
          lastModified
        }
        employmentAgreement {
          fileName
          lastModified
        }
        role
        roleType
        salaryExpectation {
          min
          period
        }
        location {
          city
          country
          subdivision
          continent
          type
        }
        locationType
        employmentType
        companySize
        companyStage
        customKeywords
        keywords {
          keyword
        }
      }
    }
  `;

  beforeEach(async () => {
    await saveFixtures(con, UserCandidatePreference, [
      {
        userId: '1',
        role: 'Full Stack Developer',
        cv: {
          blob: '1',
          contentType: 'application/pdf',
          fileName: 'cv.pdf',
          bucket: 'bucket-name',
          lastModified: new Date('2023-10-10T10:00:00Z'),
        },
        employmentAgreement: {
          blob: '2',
          contentType: 'application/pdf',
          fileName: 'employment-agreement.pdf',
          bucket: 'bucket-name',
          lastModified: new Date('2024-10-10T10:00:00Z'),
        },
        salaryExpectation: { min: '50000', period: SalaryPeriod.ANNUAL },
        location: [
          { country: 'Norway' },
          { city: 'London', country: 'UK', continent: 'Europe' },
        ],
        locationType: [LocationType.REMOTE, LocationType.HYBRID],
        employmentType: [
          EmploymentType.FULL_TIME,
          EmploymentType.PART_TIME,
          EmploymentType.CONTRACT,
        ],
        companyStage: [
          CompanyStage.SERIES_A,
          CompanyStage.SERIES_B,
          CompanyStage.GOVERNMENT,
        ],
        companySize: [
          CompanySize.COMPANY_SIZE_51_200,
          CompanySize.COMPANY_SIZE_201_500,
        ],
        customKeywords: true,
      },
      {
        userId: '2',
      },
    ]);

    await saveFixtures(con, UserCandidateKeyword, [
      {
        userId: '1',
        keyword: 'JavaScript',
      },
      {
        userId: '1',
        keyword: 'Zig',
      },
      {
        userId: '1',
        keyword: 'NATS',
      },
    ]);
  });

  it('should require authentication', async () => {
    await testQueryErrorCode(
      client,
      {
        query: QUERY,
      },
      'UNAUTHENTICATED',
    );
  });

  it('should return candidate preferences for authenticated user', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.getCandidatePreferences).toMatchObject({
      status: 3,
      role: 'Full Stack Developer',
      roleType: 0.5,
      cv: {
        fileName: 'cv.pdf',
        lastModified: '2023-10-10T10:00:00.000Z',
      },
      employmentAgreement: {
        fileName: 'employment-agreement.pdf',
        lastModified: '2024-10-10T10:00:00.000Z',
      },
      salaryExpectation: {
        min: 50000,
        period: 1,
      },
      location: [
        { country: 'Norway' },
        { city: 'London', country: 'UK', continent: 'Europe' },
      ],
      locationType: [1, 3],
      employmentType: [1, 2, 3],
      companyStage: [3, 4, 10],
      companySize: [3, 4],
      customKeywords: true,
      keywords: expect.arrayContaining([
        { keyword: 'JavaScript' },
        { keyword: 'Zig' },
        { keyword: 'NATS' },
      ]),
    });
  });

  it('should return different candidate preferences for different authenticated user', async () => {
    loggedUser = '2';

    const res = await client.query(QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.getCandidatePreferences).toEqual({
      status: 3,
      cv: {
        fileName: null,
        lastModified: null,
      },
      employmentAgreement: {
        fileName: null,
        lastModified: null,
      },
      role: null,
      roleType: 0.5,
      salaryExpectation: {
        min: null,
        period: null,
      },
      location: [],
      locationType: [1, 2, 3],
      employmentType: [1, 2, 3, 4],
      companySize: [1, 2, 3, 4, 5, 6, 7],
      companyStage: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      customKeywords: false,
      keywords: [],
    });
  });

  it('should return default candidate preferences when there are no existing preferences', async () => {
    loggedUser = '3';

    const res = await client.query(QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.getCandidatePreferences).toEqual({
      status: 3,
      cv: {
        fileName: null,
        lastModified: null,
      },
      employmentAgreement: {
        fileName: null,
        lastModified: null,
      },
      role: null,
      roleType: 0.5,
      salaryExpectation: {
        min: null,
        period: null,
      },
      location: [],
      locationType: [1, 2, 3],
      employmentType: [1, 2, 3, 4],
      companySize: [1, 2, 3, 4, 5, 6, 7],
      companyStage: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      customKeywords: false,
      keywords: [],
    });
  });
});

describe('mutation updateCandidatePreferences', () => {
  const MUTATION = /* GraphQL */ `
    mutation UpdateCandidatePreferences(
      $status: ProtoEnumValue
      $role: String
      $roleType: Float
      $employmentType: [ProtoEnumValue]
      $salaryExpectation: SalaryExpectationInput
      $location: [LocationInput]
      $locationType: [ProtoEnumValue]
      $customKeywords: Boolean
    ) {
      updateCandidatePreferences(
        status: $status
        role: $role
        roleType: $roleType
        employmentType: $employmentType
        salaryExpectation: $salaryExpectation
        location: $location
        locationType: $locationType
        customKeywords: $customKeywords
      ) {
        _
      }
    }
  `;

  it('should require authentication', async () => {
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
      },
      'UNAUTHENTICATED',
    );
  });

  it('should update candidate preferences for authenticated user', async () => {
    loggedUser = '1';

    // Ensure no existing preferences
    expect(
      await con.getRepository(UserCandidatePreference).countBy({ userId: '1' }),
    ).toBe(0);

    const res = await client.mutate(MUTATION, {
      variables: {
        status: 2,
        role: 'Backend Developer',
        roleType: 1.0,
        employmentType: [1, 3],
        salaryExpectation: { min: 70000, period: 1 },
        location: [{ city: 'Berlin', country: 'Germany' }],
        locationType: [1, 2],
        customKeywords: true,
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.updateCandidatePreferences).toEqual({ _: true });

    const updated = await con
      .getRepository(UserCandidatePreference)
      .findOneBy({ userId: '1' });

    expect(updated).toMatchObject({
      userId: '1',
      status: 2,
      role: 'Backend Developer',
      roleType: 1.0,
      employmentType: [1, 3], // FULL_TIME, CONTRACT
      salaryExpectation: { min: '70000', period: 1 }, // ANNUAL
      location: [{ city: 'Berlin', country: 'Germany' }],
      locationType: [1, 2], // REMOTE, ONSITE
      customKeywords: true,
    });
  });

  it('should throw error on invalid proto enum values', async () => {
    loggedUser = '1';

    const res = await client.mutate(MUTATION, {
      variables: {
        status: 2000,
        employmentType: [300],
        salaryExpectation: { min: 70000, period: 800 },
        locationType: [90],
      },
    });

    expect(res.errors).toBeTruthy();
    expect(res.data.updateCandidatePreferences).toEqual(null);

    const extensions = res?.errors?.[0].extensions as unknown as ZodError;
    const errors = extensions.issues.map((issue) => [
      issue.message,
      issue.path[0],
    ]);

    expect(errors).toEqual(
      expect.arrayContaining([
        ['Invalid candidate status', 'status'],
        ['Invalid employment type', 'employmentType'],
        ['Invalid salary period', 'salaryExpectation'],
        ['Invalid location type', 'locationType'],
      ]),
    );

    expect(
      await con.getRepository(UserCandidatePreference).countBy({ userId: '1' }),
    ).toBe(0);
  });

  it('should throw error when given UNSPECIFIED proto enum value', async () => {
    loggedUser = '1';

    const res = await client.mutate(MUTATION, {
      variables: {
        status: 0,
        roleType: 0.6,
        employmentType: [0],
        salaryExpectation: { period: 0 },
        locationType: [0],
      },
    });

    expect(res.errors).toBeTruthy();
    expect(res.data.updateCandidatePreferences).toEqual(null);

    const extensions = res?.errors?.[0].extensions as unknown as ZodError;
    const errors = extensions.issues.map((issue) => [
      issue.message,
      issue.path[0],
    ]);

    expect(errors).toEqual(
      expect.arrayContaining([
        ['Invalid candidate status', 'status'],
        ['Invalid role type', 'roleType'],
        ['Invalid employment type', 'employmentType'],
        ['Invalid salary period', 'salaryExpectation'],
        ['Invalid location type', 'locationType'],
      ]),
    );

    expect(
      await con.getRepository(UserCandidatePreference).countBy({ userId: '1' }),
    ).toBe(0);
  });
});

describe('mutation saveOpportunityScreeningAnswers', () => {
  const MUTATION = /* GraphQL */ `
    mutation SaveOpportunityScreeningAnswers(
      $id: ID!
      $answers: [OpportunityScreeningAnswerInput!]!
    ) {
      saveOpportunityScreeningAnswers(id: $id, answers: $answers) {
        _
      }
    }
  `;

  it('should require authentication', async () => {
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: '550e8400-e29b-41d4-a716-446655440001',
          answers: [
            {
              questionId: '750e8400-e29b-41d4-a716-446655440001',
              answer: 'JavaScript',
            },
            {
              questionId: '750e8400-e29b-41d4-a716-446655440002',
              answer: 'Built a full-stack app',
            },
          ],
        },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should save screening answers for authenticated user', async () => {
    loggedUser = '1';

    const res = await client.mutate(MUTATION, {
      variables: {
        id: '550e8400-e29b-41d4-a716-446655440001',
        answers: [
          {
            questionId: '750e8400-e29b-41d4-a716-446655440001',
            answer: 'JavaScript',
          },
          {
            questionId: '750e8400-e29b-41d4-a716-446655440002',
            answer: 'Built a full-stack app',
          },
        ],
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.saveOpportunityScreeningAnswers).toEqual({ _: true });

    const match = await con.getRepository(OpportunityMatch).findOneByOrFail({
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '1',
    });

    expect(match.screening).toEqual(
      expect.arrayContaining([
        {
          screening: 'What is your favorite programming language?',
          answer: 'JavaScript',
        },
        {
          screening: 'Describe a challenging project you worked on.',
          answer: 'Built a full-stack app',
        },
      ]),
    );
  });

  it('should return FORBIDDEN when match is not pending', async () => {
    loggedUser = '2';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: '550e8400-e29b-41d4-a716-446655440001',
          answers: [
            {
              questionId: '750e8400-e29b-41d4-a716-446655440001',
              answer: 'JavaScript',
            },
            {
              questionId: '750e8400-e29b-41d4-a716-446655440002',
              answer: 'Built a full-stack app',
            },
          ],
        },
      },
      'FORBIDDEN',
      'Access denied! Match is not pending',
    );
  });

  it('should return error when there are duplicate answers by questionId', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: '550e8400-e29b-41d4-a716-446655440001',
          answers: [
            {
              questionId: '750e8400-e29b-41d4-a716-446655440001',
              answer: 'JavaScript',
            },
            {
              questionId: '750e8400-e29b-41d4-a716-446655440001',
              answer: 'Python',
            },
            {
              questionId: '750e8400-e29b-41d4-a716-446655440002',
              answer: 'Built a full-stack app',
            },
          ],
        },
      },
      'ZOD_VALIDATION_ERROR',
      'Validation error',
      (errors) => {
        const extensions = errors[0].extensions as unknown as ZodError;
        expect(extensions.issues.length).toEqual(1);
        expect(extensions.issues[0].code).toEqual('custom');
        expect(extensions.issues[0].message).toEqual(
          'Duplicate questionId 750e8400-e29b-41d4-a716-446655440001',
        );
      },
    );
  });

  it('should return error when the questionId does not belong to opportunity', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: '550e8400-e29b-41d4-a716-446655440001',
          answers: [
            {
              questionId: '750e8400-e29b-41d4-a716-446655440001',
              answer: 'JavaScript',
            },
            {
              questionId: '750e8400-e29b-41d4-a716-446655440003',
              answer: 'Built a full-stack app',
            },
          ],
        },
      },
      'CONFLICT',
      'Question 750e8400-e29b-41d4-a716-446655440003 not found for opportunity',
    );
  });

  it('should return error when not enough answers are provided', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: '550e8400-e29b-41d4-a716-446655440001',
          answers: [
            {
              questionId: '750e8400-e29b-41d4-a716-446655440001',
              answer: 'JavaScript',
            },
          ],
        },
      },
      'CONFLICT',
      'Number of answers (1) does not match the required questions',
    );
  });
});

describe('mutation saveOpportunityFeedbackAnswers', () => {
  const MUTATION = /* GraphQL */ `
    mutation SaveOpportunityFeedbackAnswers(
      $id: ID!
      $answers: [OpportunityScreeningAnswerInput!]!
    ) {
      saveOpportunityFeedbackAnswers(id: $id, answers: $answers) {
        _
      }
    }
  `;

  it('should require authentication', async () => {
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: '550e8400-e29b-41d4-a716-446655440001',
          answers: [
            {
              questionId: '850e8400-e29b-41d4-a716-446655440001',
              answer: 'From a friend',
            },
          ],
        },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should save feedback answers for authenticated user', async () => {
    loggedUser = '1';

    const res = await client.mutate(MUTATION, {
      variables: {
        id: '550e8400-e29b-41d4-a716-446655440001',
        answers: [
          {
            questionId: '850e8400-e29b-41d4-a716-446655440001',
            answer: 'From a friend',
          },
          {
            questionId: '850e8400-e29b-41d4-a716-446655440002',
            answer: 'The company culture',
          },
        ],
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.saveOpportunityFeedbackAnswers).toEqual({ _: true });

    const match = await con.getRepository(OpportunityMatch).findOneByOrFail({
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '1',
    });

    expect(match.feedback).toEqual(
      expect.arrayContaining([
        {
          screening: 'How did you hear about this opportunity?',
          answer: 'From a friend',
        },
        {
          screening: 'What interests you most about this role?',
          answer: 'The company culture',
        },
      ]),
    );
  });

  it('should allow partial feedback answers since they are optional', async () => {
    loggedUser = '1';

    const res = await client.mutate(MUTATION, {
      variables: {
        id: '550e8400-e29b-41d4-a716-446655440001',
        answers: [
          {
            questionId: '850e8400-e29b-41d4-a716-446655440001',
            answer: 'From LinkedIn',
          },
        ],
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.saveOpportunityFeedbackAnswers).toEqual({ _: true });

    const match = await con.getRepository(OpportunityMatch).findOneByOrFail({
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '1',
    });

    expect(match.feedback).toEqual([
      {
        screening: 'How did you hear about this opportunity?',
        answer: 'From LinkedIn',
      },
    ]);
  });

  it('should allow empty feedback answers since they are optional', async () => {
    loggedUser = '1';

    const res = await client.mutate(MUTATION, {
      variables: {
        id: '550e8400-e29b-41d4-a716-446655440001',
        answers: [],
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.saveOpportunityFeedbackAnswers).toEqual({ _: true });

    const match = await con.getRepository(OpportunityMatch).findOneByOrFail({
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '1',
    });

    expect(match.feedback).toEqual([]);
  });

  it('should return FORBIDDEN when match does not exist', async () => {
    loggedUser = '3';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: '550e8400-e29b-41d4-a716-446655440002',
          answers: [
            {
              questionId: '850e8400-e29b-41d4-a716-446655440001',
              answer: 'From a friend',
            },
          ],
        },
      },
      'FORBIDDEN',
      'Access denied! No match found',
    );
  });

  it('should return error when there are duplicate answers by questionId', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: '550e8400-e29b-41d4-a716-446655440001',
          answers: [
            {
              questionId: '850e8400-e29b-41d4-a716-446655440001',
              answer: 'From a friend',
            },
            {
              questionId: '850e8400-e29b-41d4-a716-446655440001',
              answer: 'From LinkedIn',
            },
          ],
        },
      },
      'ZOD_VALIDATION_ERROR',
      'Validation error',
      (errors) => {
        const extensions = errors[0].extensions as unknown as ZodError;
        expect(extensions.issues.length).toEqual(1);
        expect(extensions.issues[0].code).toEqual('custom');
        expect(extensions.issues[0].message).toEqual(
          'Duplicate questionId 850e8400-e29b-41d4-a716-446655440001',
        );
      },
    );
  });

  it('should return error when the questionId does not belong to opportunity', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: '550e8400-e29b-41d4-a716-446655440001',
          answers: [
            {
              questionId: '750e8400-e29b-41d4-a716-446655440003',
              answer: 'Invalid question',
            },
          ],
        },
      },
      'CONFLICT',
      'Question 750e8400-e29b-41d4-a716-446655440003 not found for opportunity',
    );
  });
});

describe('mutation acceptOpportunityMatch', () => {
  const MUTATION = /* GraphQL */ `
    mutation AcceptOpportunityMatch($id: ID!) {
      acceptOpportunityMatch(id: $id) {
        _
      }
    }
  `;

  it('should require authentication', async () => {
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: '550e8400-e29b-41d4-a716-446655440001',
        },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should accept opportunity match for authenticated user', async () => {
    loggedUser = '1';

    expect(
      await con.getRepository(OpportunityMatch).countBy({
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        userId: '1',
        status: OpportunityMatchStatus.Pending,
      }),
    ).toEqual(1);

    const res = await client.mutate(MUTATION, {
      variables: {
        id: '550e8400-e29b-41d4-a716-446655440001',
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.acceptOpportunityMatch).toEqual({ _: true });

    expect(
      await con.getRepository(OpportunityMatch).countBy({
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        userId: '1',
        status: OpportunityMatchStatus.CandidateAccepted,
      }),
    ).toEqual(1);
  });

  it('should clear alert when accepting opportunity match', async () => {
    loggedUser = '1';

    await saveFixtures(con, Alerts, [
      {
        userId: '1',
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      },
    ]);

    const res = await client.mutate(MUTATION, {
      variables: {
        id: '550e8400-e29b-41d4-a716-446655440001',
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.acceptOpportunityMatch).toEqual({ _: true });

    expect(
      await con.getRepository(Alerts).countBy({
        userId: '1',
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      }),
    ).toEqual(0);
    expect(
      await con
        .getRepository(Alerts)
        .countBy({ userId: '1', opportunityId: IsNull() }),
    ).toEqual(1);
  });

  it('should return error when the match is not pending', async () => {
    loggedUser = '2';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: '550e8400-e29b-41d4-a716-446655440001',
        },
      },
      'FORBIDDEN',
      'Access denied! Match is not pending',
    );
  });
});

describe('mutation rejectOpportunityMatch', () => {
  const MUTATION = /* GraphQL */ `
    mutation RejectOpportunityMatch($id: ID!) {
      rejectOpportunityMatch(id: $id) {
        _
      }
    }
  `;

  it('should require authentication', async () => {
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: '550e8400-e29b-41d4-a716-446655440001',
        },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should accept opportunity match for authenticated user', async () => {
    loggedUser = '1';

    expect(
      await con.getRepository(OpportunityMatch).countBy({
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        userId: '1',
        status: OpportunityMatchStatus.Pending,
      }),
    ).toEqual(1);

    const res = await client.mutate(MUTATION, {
      variables: {
        id: '550e8400-e29b-41d4-a716-446655440001',
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.rejectOpportunityMatch).toEqual({ _: true });

    expect(
      await con.getRepository(OpportunityMatch).countBy({
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        userId: '1',
        status: OpportunityMatchStatus.CandidateRejected,
      }),
    ).toEqual(1);
  });

  it('should clear alert when rejecting opportunity match', async () => {
    loggedUser = '1';

    await saveFixtures(con, Alerts, [
      {
        userId: '1',
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      },
    ]);

    const res = await client.mutate(MUTATION, {
      variables: {
        id: '550e8400-e29b-41d4-a716-446655440001',
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.rejectOpportunityMatch).toEqual({ _: true });

    expect(
      await con.getRepository(Alerts).countBy({
        userId: '1',
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      }),
    ).toEqual(0);
    expect(
      await con
        .getRepository(Alerts)
        .countBy({ userId: '1', opportunityId: IsNull() }),
    ).toEqual(1);
  });

  it('should return error when the match is not pending', async () => {
    loggedUser = '2';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: '550e8400-e29b-41d4-a716-446655440001',
        },
      },
      'FORBIDDEN',
      'Access denied! Match is not pending',
    );
  });
});

describe('mutation recruiterAcceptOpportunityMatch', () => {
  const MUTATION = /* GraphQL */ `
    mutation RecruiterAcceptOpportunityMatch(
      $opportunityId: ID!
      $candidateUserId: ID!
    ) {
      recruiterAcceptOpportunityMatch(
        opportunityId: $opportunityId
        candidateUserId: $candidateUserId
      ) {
        _
      }
    }
  `;

  it('should require authentication', async () => {
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          opportunityId: '550e8400-e29b-41d4-a716-446655440001',
          candidateUserId: '2',
        },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should accept candidate match for authenticated recruiter', async () => {
    loggedUser = '1';

    // Add recruiter permission
    await saveFixtures(con, OpportunityUser, [
      {
        opportunityId: opportunitiesFixture[0].id,
        userId: usersFixture[0].id,
        type: OpportunityUserType.Recruiter,
      },
    ]);

    const res = await client.mutate(MUTATION, {
      variables: {
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        candidateUserId: '2',
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.recruiterAcceptOpportunityMatch).toEqual({ _: true });

    const match = await con.getRepository(OpportunityMatch).findOneByOrFail({
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '2',
    });
    expect(match.status).toBe(OpportunityMatchStatus.RecruiterAccepted);
  });

  it('should return error when user is not a recruiter', async () => {
    loggedUser = '3'; // Not a recruiter

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          opportunityId: '550e8400-e29b-41d4-a716-446655440001',
          candidateUserId: '2',
        },
      },
      'FORBIDDEN',
    );
  });

  it('should return error when match is not candidate_accepted', async () => {
    loggedUser = '1';

    await saveFixtures(con, OpportunityUser, [
      {
        opportunityId: opportunitiesFixture[0].id,
        userId: usersFixture[0].id,
        type: OpportunityUserType.Recruiter,
      },
    ]);

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          opportunityId: '550e8400-e29b-41d4-a716-446655440001',
          candidateUserId: '1', // This user has status pending
        },
      },
      'FORBIDDEN',
      'Access denied! Match must be in candidate_accepted status',
    );
  });

  it('should return error when match does not exist', async () => {
    loggedUser = '1';

    await saveFixtures(con, OpportunityUser, [
      {
        opportunityId: opportunitiesFixture[0].id,
        userId: usersFixture[0].id,
        type: OpportunityUserType.Recruiter,
      },
    ]);

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          opportunityId: '550e8400-e29b-41d4-a716-446655440001',
          candidateUserId: '999', // Non-existent user
        },
      },
      'FORBIDDEN',
      'Access denied! No match found',
    );
  });

  it('should not allow accepting an already accepted match', async () => {
    loggedUser = '1';

    await saveFixtures(con, OpportunityUser, [
      {
        opportunityId: opportunitiesFixture[0].id,
        userId: usersFixture[0].id,
        type: OpportunityUserType.Recruiter,
      },
    ]);

    // Add a match that's already recruiter accepted
    await saveFixtures(con, OpportunityMatch, [
      {
        opportunityId: opportunitiesFixture[0].id,
        userId: '4',
        status: OpportunityMatchStatus.RecruiterAccepted,
        description: { reasoning: 'Already accepted' },
      },
    ]);

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          opportunityId: '550e8400-e29b-41d4-a716-446655440001',
          candidateUserId: '4',
        },
      },
      'FORBIDDEN',
      'Access denied! Match must be in candidate_accepted status',
    );
  });

  it('should not allow accepting an already rejected match', async () => {
    loggedUser = '1';

    await saveFixtures(con, OpportunityUser, [
      {
        opportunityId: opportunitiesFixture[0].id,
        userId: usersFixture[0].id,
        type: OpportunityUserType.Recruiter,
      },
    ]);

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          opportunityId: '550e8400-e29b-41d4-a716-446655440001',
          candidateUserId: '3', // This user has recruiter_rejected status
        },
      },
      'FORBIDDEN',
      'Access denied! Match must be in candidate_accepted status',
    );
  });

  it('should allow team members to accept matches', async () => {
    loggedUser = '1';
    isTeamMember = true;

    const res = await client.mutate(MUTATION, {
      variables: {
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        candidateUserId: '2',
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.recruiterAcceptOpportunityMatch).toEqual({ _: true });

    const match = await con.getRepository(OpportunityMatch).findOneByOrFail({
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '2',
    });
    expect(match.status).toBe(OpportunityMatchStatus.RecruiterAccepted);

    isTeamMember = false;
  });

  it('should work for different recruiters on the same opportunity', async () => {
    loggedUser = '3';

    // Add user 3 as a recruiter for opportunity 1
    await saveFixtures(con, OpportunityUser, [
      {
        opportunityId: opportunitiesFixture[0].id,
        userId: usersFixture[2].id, // User 3
        type: OpportunityUserType.Recruiter,
      },
    ]);

    // Add a new candidate match that's accepted by candidate
    await saveFixtures(con, OpportunityMatch, [
      {
        opportunityId: opportunitiesFixture[0].id,
        userId: '4',
        status: OpportunityMatchStatus.CandidateAccepted,
        description: { reasoning: 'New candidate' },
        screening: [],
        feedback: [],
        applicationRank: {},
      },
    ]);

    const res = await client.mutate(MUTATION, {
      variables: {
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        candidateUserId: '4',
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.recruiterAcceptOpportunityMatch).toEqual({ _: true });

    const match = await con.getRepository(OpportunityMatch).findOneByOrFail({
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '4',
    });
    expect(match.status).toBe(OpportunityMatchStatus.RecruiterAccepted);
  });

  it('should verify status transition from candidate_accepted to recruiter_accepted', async () => {
    loggedUser = '1';

    await saveFixtures(con, OpportunityUser, [
      {
        opportunityId: opportunitiesFixture[0].id,
        userId: usersFixture[0].id,
        type: OpportunityUserType.Recruiter,
      },
    ]);

    // Verify initial status
    let match = await con.getRepository(OpportunityMatch).findOneByOrFail({
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '2',
    });
    expect(match.status).toBe(OpportunityMatchStatus.CandidateAccepted);

    // Accept the match
    const res = await client.mutate(MUTATION, {
      variables: {
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        candidateUserId: '2',
      },
    });

    expect(res.errors).toBeFalsy();

    // Verify status changed
    match = await con.getRepository(OpportunityMatch).findOneByOrFail({
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '2',
    });
    expect(match.status).toBe(OpportunityMatchStatus.RecruiterAccepted);
  });
});

describe('mutation recruiterRejectOpportunityMatch', () => {
  const MUTATION = /* GraphQL */ `
    mutation RecruiterRejectOpportunityMatch(
      $opportunityId: ID!
      $candidateUserId: ID!
    ) {
      recruiterRejectOpportunityMatch(
        opportunityId: $opportunityId
        candidateUserId: $candidateUserId
      ) {
        _
      }
    }
  `;

  it('should require authentication', async () => {
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          opportunityId: '550e8400-e29b-41d4-a716-446655440001',
          candidateUserId: '2',
        },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should reject candidate match for authenticated recruiter', async () => {
    loggedUser = '1';

    // Add recruiter permission
    await saveFixtures(con, OpportunityUser, [
      {
        opportunityId: opportunitiesFixture[0].id,
        userId: usersFixture[0].id,
        type: OpportunityUserType.Recruiter,
      },
    ]);

    const res = await client.mutate(MUTATION, {
      variables: {
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        candidateUserId: '2',
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.recruiterRejectOpportunityMatch).toEqual({ _: true });

    const match = await con.getRepository(OpportunityMatch).findOneByOrFail({
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '2',
    });
    expect(match.status).toBe(OpportunityMatchStatus.RecruiterRejected);
  });

  it('should return error when user is not a recruiter', async () => {
    loggedUser = '3'; // Not a recruiter

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          opportunityId: '550e8400-e29b-41d4-a716-446655440001',
          candidateUserId: '2',
        },
      },
      'FORBIDDEN',
    );
  });

  it('should return error when match is not candidate_accepted', async () => {
    loggedUser = '1';

    await saveFixtures(con, OpportunityUser, [
      {
        opportunityId: opportunitiesFixture[0].id,
        userId: usersFixture[0].id,
        type: OpportunityUserType.Recruiter,
      },
    ]);

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          opportunityId: '550e8400-e29b-41d4-a716-446655440001',
          candidateUserId: '1', // This user has status pending
        },
      },
      'FORBIDDEN',
      'Access denied! Match must be in candidate_accepted status',
    );
  });

  it('should return error when match does not exist', async () => {
    loggedUser = '1';

    await saveFixtures(con, OpportunityUser, [
      {
        opportunityId: opportunitiesFixture[0].id,
        userId: usersFixture[0].id,
        type: OpportunityUserType.Recruiter,
      },
    ]);

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          opportunityId: '550e8400-e29b-41d4-a716-446655440001',
          candidateUserId: '999', // Non-existent user
        },
      },
      'FORBIDDEN',
      'Access denied! No match found',
    );
  });

  it('should not allow rejecting an already rejected match', async () => {
    loggedUser = '1';

    await saveFixtures(con, OpportunityUser, [
      {
        opportunityId: opportunitiesFixture[0].id,
        userId: usersFixture[0].id,
        type: OpportunityUserType.Recruiter,
      },
    ]);

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          opportunityId: '550e8400-e29b-41d4-a716-446655440001',
          candidateUserId: '3', // This user has recruiter_rejected status
        },
      },
      'FORBIDDEN',
      'Access denied! Match must be in candidate_accepted status',
    );
  });

  it('should not allow rejecting an already accepted match', async () => {
    loggedUser = '1';

    await saveFixtures(con, OpportunityUser, [
      {
        opportunityId: opportunitiesFixture[0].id,
        userId: usersFixture[0].id,
        type: OpportunityUserType.Recruiter,
      },
    ]);

    // Add a match that's already recruiter accepted
    await saveFixtures(con, OpportunityMatch, [
      {
        opportunityId: opportunitiesFixture[0].id,
        userId: '4',
        status: OpportunityMatchStatus.RecruiterAccepted,
        description: { reasoning: 'Already accepted' },
      },
    ]);

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          opportunityId: '550e8400-e29b-41d4-a716-446655440001',
          candidateUserId: '4',
        },
      },
      'FORBIDDEN',
      'Access denied! Match must be in candidate_accepted status',
    );
  });

  it('should allow team members to reject matches', async () => {
    loggedUser = '1';
    isTeamMember = true;

    const res = await client.mutate(MUTATION, {
      variables: {
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        candidateUserId: '2',
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.recruiterRejectOpportunityMatch).toEqual({ _: true });

    const match = await con.getRepository(OpportunityMatch).findOneByOrFail({
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '2',
    });
    expect(match.status).toBe(OpportunityMatchStatus.RecruiterRejected);

    isTeamMember = false;
  });

  it('should work for different recruiters on the same opportunity', async () => {
    loggedUser = '3';

    // Add user 3 as a recruiter for opportunity 1
    await saveFixtures(con, OpportunityUser, [
      {
        opportunityId: opportunitiesFixture[0].id,
        userId: usersFixture[2].id, // User 3
        type: OpportunityUserType.Recruiter,
      },
    ]);

    // Add a new candidate match that's accepted by candidate
    await saveFixtures(con, OpportunityMatch, [
      {
        opportunityId: opportunitiesFixture[0].id,
        userId: '4',
        status: OpportunityMatchStatus.CandidateAccepted,
        description: { reasoning: 'New candidate' },
        screening: [],
        feedback: [],
        applicationRank: {},
      },
    ]);

    const res = await client.mutate(MUTATION, {
      variables: {
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        candidateUserId: '4',
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.recruiterRejectOpportunityMatch).toEqual({ _: true });

    const match = await con.getRepository(OpportunityMatch).findOneByOrFail({
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '4',
    });
    expect(match.status).toBe(OpportunityMatchStatus.RecruiterRejected);
  });

  it('should verify status transition from candidate_accepted to recruiter_rejected', async () => {
    loggedUser = '1';

    await saveFixtures(con, OpportunityUser, [
      {
        opportunityId: opportunitiesFixture[0].id,
        userId: usersFixture[0].id,
        type: OpportunityUserType.Recruiter,
      },
    ]);

    // Verify initial status
    let match = await con.getRepository(OpportunityMatch).findOneByOrFail({
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '2',
    });
    expect(match.status).toBe(OpportunityMatchStatus.CandidateAccepted);

    // Reject the match
    const res = await client.mutate(MUTATION, {
      variables: {
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
        candidateUserId: '2',
      },
    });

    expect(res.errors).toBeFalsy();

    // Verify status changed
    match = await con.getRepository(OpportunityMatch).findOneByOrFail({
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '2',
    });
    expect(match.status).toBe(OpportunityMatchStatus.RecruiterRejected);
  });
});

describe('mutation candidateAddKeywords', () => {
  const MUTATION = /* GraphQL */ `
    mutation CandidateAddKeywords($keywords: [String!]!) {
      candidateAddKeywords(keywords: $keywords) {
        _
      }
    }
  `;

  it('should require authentication', async () => {
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { keywords: ['NewKeyword'] },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should add keyword to candidate profile', async () => {
    loggedUser = '1';

    expect(
      await con.getRepository(UserCandidateKeyword).countBy({ userId: '1' }),
    ).toBe(0);

    const res = await client.mutate(MUTATION, {
      variables: { keywords: ['  NewKeyword  '] },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.candidateAddKeywords).toEqual({ _: true });

    expect(
      await con.getRepository(UserCandidateKeyword).findBy({ userId: '1' }),
    ).toEqual([
      {
        userId: '1',
        keyword: 'NewKeyword',
      },
    ]);
  });

  it('should not add duplicate keyword to candidate profile', async () => {
    loggedUser = '1';

    await con.getRepository(UserCandidateKeyword).insert({
      userId: '1',
      keyword: 'ExistingKeyword',
    });

    expect(
      await con.getRepository(UserCandidateKeyword).countBy({ userId: '1' }),
    ).toBe(1);

    const res = await client.mutate(MUTATION, {
      variables: { keywords: ['  ExistingKeyword  '] },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.candidateAddKeywords).toEqual({ _: true });

    expect(
      await con.getRepository(UserCandidateKeyword).findBy({ userId: '1' }),
    ).toEqual([
      {
        userId: '1',
        keyword: 'ExistingKeyword',
      },
    ]);
  });

  it('should add multiple keywords to candidate profile', async () => {
    loggedUser = '1';

    expect(
      await con.getRepository(UserCandidateKeyword).countBy({ userId: '1' }),
    ).toBe(0);

    const res = await client.mutate(MUTATION, {
      variables: { keywords: ['Keyword1', '  Keyword2  ', 'Keyword3'] },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.candidateAddKeywords).toEqual({ _: true });

    expect(
      await con.getRepository(UserCandidateKeyword).findBy({ userId: '1' }),
    ).toEqual(
      expect.arrayContaining([
        { userId: '1', keyword: 'Keyword1' },
        { userId: '1', keyword: 'Keyword2' },
        { userId: '1', keyword: 'Keyword3' },
      ]),
    );
  });

  it('should return error on empty keyword', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { keywords: ['   '] },
      },
      'ZOD_VALIDATION_ERROR',
      'Validation error',
      (errors) => {
        const extensions = errors[0].extensions as unknown as ZodError;
        expect(extensions.issues.length).toEqual(1);
        expect(extensions.issues[0].code).toEqual('too_small');
        expect(extensions.issues[0].message).toEqual('Keyword cannot be empty');
      },
    );

    expect(
      await con.getRepository(UserCandidateKeyword).countBy({ userId: '1' }),
    ).toBe(0);
  });

  it('should return error when no keywords', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          keywords: [],
        },
      },
      'ZOD_VALIDATION_ERROR',
      'Validation error',
      (errors) => {
        const extensions = errors[0].extensions as unknown as ZodError;
        expect(extensions.issues.length).toEqual(1);
        expect(extensions.issues[0].code).toEqual('too_small');
        expect(extensions.issues[0].message).toEqual(
          'At least one keyword is required',
        );
      },
    );

    expect(
      await con.getRepository(UserCandidateKeyword).countBy({ userId: '1' }),
    ).toBe(0);
  });

  it('should return error on too many keywords', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          keywords: Array.from({ length: 101 }, (_, i) => `keyword-${i}`),
        },
      },
      'ZOD_VALIDATION_ERROR',
      'Validation error',
      (errors) => {
        const extensions = errors[0].extensions as unknown as ZodError;
        expect(extensions.issues.length).toEqual(1);
        expect(extensions.issues[0].code).toEqual('too_big');
        expect(extensions.issues[0].message).toEqual(
          'Too many keywords provided',
        );
      },
    );

    expect(
      await con.getRepository(UserCandidateKeyword).countBy({ userId: '1' }),
    ).toBe(0);
  });
});

describe('mutation candidateRemoveKeywords', () => {
  const MUTATION = /* GraphQL */ `
    mutation CandidateRemoveKeywords($keywords: [String!]!) {
      candidateRemoveKeywords(keywords: $keywords) {
        _
      }
    }
  `;

  it('should require authentication', async () => {
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { keywords: ['SomeKeyword'] },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should remove keyword from candidate profile', async () => {
    loggedUser = '1';

    await con.getRepository(UserCandidateKeyword).insert({
      userId: '1',
      keyword: 'RemoveMe',
    });

    expect(
      await con.getRepository(UserCandidateKeyword).countBy({ userId: '1' }),
    ).toBe(1);

    const res = await client.mutate(MUTATION, {
      variables: { keywords: ['   RemoveMe   '] },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.candidateRemoveKeywords).toEqual({ _: true });

    expect(
      await con.getRepository(UserCandidateKeyword).findBy({ userId: '1' }),
    ).toEqual([]);
  });

  it('should be idempotent if keyword does not exist', async () => {
    loggedUser = '1';

    expect(
      await con.getRepository(UserCandidateKeyword).countBy({ userId: '1' }),
    ).toBe(0);

    const res = await client.mutate(MUTATION, {
      variables: { keywords: ['NonExistingKeyword'] },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.candidateRemoveKeywords).toEqual({ _: true });

    expect(
      await con.getRepository(UserCandidateKeyword).countBy({ userId: '1' }),
    ).toBe(0);
  });

  it('should remove multiple keywords from candidate profile', async () => {
    loggedUser = '1';

    await con.getRepository(UserCandidateKeyword).insert([
      { userId: '1', keyword: 'Keyword1' },
      { userId: '1', keyword: 'Keyword2' },
      { userId: '1', keyword: 'Keyword3' },
      { userId: '1', keyword: 'Keyword4' },
    ]);

    expect(
      await con.getRepository(UserCandidateKeyword).countBy({ userId: '1' }),
    ).toBe(4);

    const res = await client.mutate(MUTATION, {
      variables: { keywords: ['Keyword1', '  Keyword2  ', 'Keyword3'] },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.candidateRemoveKeywords).toEqual({ _: true });

    expect(
      await con.getRepository(UserCandidateKeyword).findBy({ userId: '1' }),
    ).toEqual(expect.arrayContaining([{ userId: '1', keyword: 'Keyword4' }]));
  });

  it('should return error on empty keyword', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { keywords: ['   '] },
      },
      'ZOD_VALIDATION_ERROR',
      'Validation error',
      (errors) => {
        const extensions = errors[0].extensions as unknown as ZodError;
        expect(extensions.issues.length).toEqual(1);
        expect(extensions.issues[0].code).toEqual('too_small');
        expect(extensions.issues[0].message).toEqual('Keyword cannot be empty');
      },
    );

    expect(
      await con.getRepository(UserCandidateKeyword).countBy({ userId: '1' }),
    ).toBe(0);
  });

  it('should return error when no keywords', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          keywords: [],
        },
      },
      'ZOD_VALIDATION_ERROR',
      'Validation error',
      (errors) => {
        const extensions = errors[0].extensions as unknown as ZodError;
        expect(extensions.issues.length).toEqual(1);
        expect(extensions.issues[0].code).toEqual('too_small');
        expect(extensions.issues[0].message).toEqual(
          'At least one keyword is required',
        );
      },
    );

    expect(
      await con.getRepository(UserCandidateKeyword).countBy({ userId: '1' }),
    ).toBe(0);
  });

  it('should return error on too many keywords', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          keywords: Array.from({ length: 101 }, (_, i) => `keyword-${i}`),
        },
      },
      'ZOD_VALIDATION_ERROR',
      'Validation error',
      (errors) => {
        const extensions = errors[0].extensions as unknown as ZodError;
        expect(extensions.issues.length).toEqual(1);
        expect(extensions.issues[0].code).toEqual('too_big');
        expect(extensions.issues[0].message).toEqual(
          'Too many keywords provided',
        );
      },
    );

    expect(
      await con.getRepository(UserCandidateKeyword).countBy({ userId: '1' }),
    ).toBe(0);
  });
});

describe('mutation clearEmploymentAgreement', () => {
  const MUTATION = /* GraphQL */ `
    mutation ClearEmploymentAgreement {
      clearEmploymentAgreement {
        _
      }
    }
  `;

  beforeEach(async () => {
    await saveFixtures(con, UserCandidatePreference, [
      {
        userId: '1',
        employmentAgreement: { blob: 'blobname' },
      },
    ]);
  });

  it('should require authentication', async () => {
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
      },
      'UNAUTHENTICATED',
    );
  });

  it('should delete user employment agreement if it exists', async () => {
    loggedUser = '1';

    await client.mutate(MUTATION);

    expect(deleteFileFromBucket).toHaveBeenCalledWith(
      expect.any(Bucket),
      'employment-agreement/1',
    );

    const ucp = await con
      .getRepository(UserCandidatePreference)
      .findOneByOrFail({
        userId: loggedUser,
      });

    expect(ucp.cv).toEqual({});
    expect(ucp.cvParsed).toEqual({});
  });

  it('should handle case when user has no candidate preferences', async () => {
    loggedUser = '2';

    expect(
      await con.getRepository(UserCandidatePreference).countBy({
        userId: loggedUser,
      }),
    ).toEqual(0);

    await client.mutate(MUTATION);

    expect(deleteFileFromBucket).toHaveBeenCalledWith(
      expect.any(Bucket),
      'employment-agreement/2',
    );

    expect(
      await con.getRepository(UserCandidatePreference).countBy({
        userId: loggedUser,
      }),
    ).toEqual(0);
  });
});

describe('mutation uploadEmploymentAgreement', () => {
  const MUTATION = /* GraphQL */ `
    mutation UploadEmploymentAgreement($file: Upload!) {
      uploadEmploymentAgreement(file: $file) {
        _
      }
    }
  `;

  beforeEach(async () => {
    jest.clearAllMocks();
    await deleteRedisKey(
      `${rateLimiterName}:1:Mutation.uploadEmploymentAgreement`,
    );
  });

  it('should throw error when file is missing', async () => {
    loggedUser = '1';

    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should require authentication', async () => {
    loggedUser = '';

    const res = await authorizeRequest(
      request(app.server)
        .post('/graphql')
        .field(
          'operations',
          JSON.stringify({
            query: MUTATION,
            variables: { file: null },
          }),
        )
        .field('map', JSON.stringify({ '0': ['variables.file'] }))
        .attach('0', './__tests__/fixture/happy_card.png', 'sample.pdf'),
      loggedUser,
    ).expect(200);

    const body = res.body;
    expect(body.errors).toBeTruthy();
    expect(body.errors[0].extensions.code).toEqual('UNAUTHENTICATED');
  });

  it('should upload pdf agreement successfully', async () => {
    loggedUser = '1';

    // mock the file-type check to allow PDF files
    fileTypeFromBuffer.mockResolvedValue({
      ext: 'pdf',
      mime: 'application/pdf',
    });

    // Mock the upload function to return a URL
    uploadEmploymentAgreementFromBuffer.mockResolvedValue(
      `https://storage.cloud.google.com/${EMPLOYMENT_AGREEMENT_BUCKET_NAME}/1`,
    );

    // Execute the mutation with a file upload
    const res = await authorizeRequest(
      request(app.server)
        .post('/graphql')
        .field(
          'operations',
          JSON.stringify({
            query: MUTATION,
            variables: { file: null },
          }),
        )
        .field('map', JSON.stringify({ '0': ['variables.file'] }))
        .attach('0', './__tests__/fixture/screen.pdf'),
      loggedUser,
    ).expect(200);

    // Verify the response
    const body = res.body;
    expect(body.errors).toBeFalsy();

    // Verify the mocks were called correctly
    expect(uploadEmploymentAgreementFromBuffer).toHaveBeenCalledWith(
      loggedUser,
      expect.any(Object),
      { contentType: 'application/pdf' },
    );

    const ucp = await con
      .getRepository(UserCandidatePreference)
      .findOneByOrFail({
        userId: loggedUser,
      });

    const { bucketName } = googleCloud.gcsBucketMap.employmentAgreement;

    expect(ucp.employmentAgreement).toEqual(
      expect.objectContaining({
        blob: loggedUser,
        fileName: 'screen.pdf',
        bucket: bucketName,
        contentType: 'application/pdf',
        lastModified: expect.any(String),
      }),
    );
  });

  it('should throw error when file extension is not supported', async () => {
    loggedUser = '1';

    const res = await authorizeRequest(
      request(app.server)
        .post('/graphql')
        .field(
          'operations',
          JSON.stringify({
            query: MUTATION,
            variables: { file: null },
          }),
        )
        .field('map', JSON.stringify({ '0': ['variables.file'] }))
        .attach('0', './__tests__/fixture/happy_card.png'),
      loggedUser,
    ).expect(200);

    const body = res.body;
    const extensions = body?.errors?.[0].extensions as unknown as ZodError;

    expect(body.errors).toBeTruthy();
    expect(body.errors[0].message).toEqual('Validation error');
    expect(body.errors[0].extensions.code).toEqual('ZOD_VALIDATION_ERROR');
    expect(extensions.issues[0].code).toEqual('custom');
    expect(extensions.issues[0].message).toEqual('Unsupported file type');
    expect(extensions.issues[0].path).toEqual(['file', 'extension']);
  });

  it('should throw error when file type does not match extension', async () => {
    loggedUser = '1';

    // mock the file-type check to allow PDF files
    fileTypeFromBuffer.mockResolvedValue({
      ext: 'png',
      mime: 'image/png',
    });

    // Rename the file to have a .pdf extension
    const res = await authorizeRequest(
      request(app.server)
        .post('/graphql')
        .field(
          'operations',
          JSON.stringify({
            query: MUTATION,
            variables: { file: null },
          }),
        )
        .field('map', JSON.stringify({ '0': ['variables.file'] }))
        .attach('0', './__tests__/fixture/happy_card.png', 'fake.pdf'),
      loggedUser,
    ).expect(200);

    const body = res.body;
    const extensions = body?.errors?.[0].extensions as unknown as ZodError;

    expect(body.errors).toBeTruthy();
    expect(body.errors[0].message).toEqual('Validation error');
    expect(body.errors[0].extensions.code).toEqual('ZOD_VALIDATION_ERROR');
    expect(extensions.issues[0].code).toEqual('custom');
    expect(extensions.issues[0].message).toEqual(
      'File type does not match file extension',
    );
    expect(extensions.issues[0].path).toEqual(['file', 'mimetype']);
  });

  it('should throw error when file content does not match file extension', async () => {
    loggedUser = '1';

    // mock the file-type check to allow PDF files
    fileTypeFromBuffer.mockResolvedValue({
      ext: 'pdf',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // Incorrect mime type for a PDF
    });

    const res = await authorizeRequest(
      request(app.server)
        .post('/graphql')
        .field(
          'operations',
          JSON.stringify({
            query: MUTATION,
            variables: { file: null },
          }),
        )
        .field('map', JSON.stringify({ '0': ['variables.file'] }))
        .attach('0', './__tests__/fixture/screen.pdf'),
      loggedUser,
    ).expect(200);

    const body = res.body;
    const extensions = body?.errors?.[0].extensions as unknown as ZodError;

    expect(body.errors).toBeTruthy();
    expect(body.errors[0].message).toEqual('Validation error');
    expect(body.errors[0].extensions.code).toEqual('ZOD_VALIDATION_ERROR');
    expect(extensions.issues[0].code).toEqual('custom');
    expect(extensions.issues[0].message).toEqual(
      'File content does not match file extension',
    );
    expect(extensions.issues[0].path).toEqual(['file', 'buffer']);
  });
});

describe('mutation editOpportunity', () => {
  beforeEach(async () => {
    await con.getRepository(OpportunityJob).update(
      {
        id: opportunitiesFixture[0].id,
      },
      {
        state: OpportunityState.DRAFT,
      },
    );
  });

  const MUTATION = /* GraphQL */ `
    mutation EditOpportunity($id: ID!, $payload: OpportunityEditInput!) {
      editOpportunity(id: $id, payload: $payload) {
        id
        title
        tldr
        content {
          overview {
            content
            html
          }
          requirements {
            content
            html
          }
        }
        meta {
          roleType
          teamSize
          seniorityLevel
          employmentType
          salary {
            min
            max
            period
          }
        }
        location {
          city
          country
          type
        }
        keywords {
          keyword
        }
        questions {
          id
          title
          placeholder
        }
      }
    }
  `;

  it('should require authentication', async () => {
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: opportunitiesFixture[0].id,
          payload: { title: 'New Title' },
        },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should throw error when user is not a recruiter for opportunity', async () => {
    loggedUser = '2';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: opportunitiesFixture[0].id,
          payload: { title: 'Illegal edit' },
        },
      },
      'FORBIDDEN',
      'Access denied!',
    );
  });

  it('should throw error when opportunity does not exist', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: '660e8400-e29b-41d4-a716-446655440999',
          payload: { title: 'Does not matter' },
        },
      },
      'FORBIDDEN',
    );
  });

  it('should edit opportunity', async () => {
    loggedUser = '1';

    const res = await client.mutate(MUTATION, {
      variables: {
        id: opportunitiesFixture[0].id,
        payload: {
          title: 'Updated Senior Full Stack Developer',
          tldr: 'Updated TLDR',
          location: [{ country: 'Germany', type: LocationType.REMOTE }],
          meta: {
            employmentType: EmploymentType.INTERNSHIP,
            teamSize: 100,
            salary: { min: 100, max: 200, period: SalaryPeriod.HOURLY },
            seniorityLevel: SeniorityLevel.VP,
            roleType: RoleType.Managerial,
          },
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.editOpportunity).toMatchObject({
      id: opportunitiesFixture[0].id,
      title: 'Updated Senior Full Stack Developer',
      tldr: 'Updated TLDR',
      location: [{ country: 'Germany', city: null, type: 1 }],
      meta: {
        employmentType: EmploymentType.INTERNSHIP,
        teamSize: 100,
        salary: {
          min: 100,
          max: 200,
          period: SalaryPeriod.HOURLY,
        },
        seniorityLevel: SeniorityLevel.VP,
        roleType: RoleType.Managerial,
      },
    });
  });

  it('should edit opportunity keywords', async () => {
    loggedUser = '1';

    const res = await client.mutate(MUTATION, {
      variables: {
        id: opportunitiesFixture[0].id,
        payload: {
          keywords: [
            { keyword: ' ios  ' },
            { keyword: 'webdev' },
            { keyword: 'ps5  ' },
            { keyword: 'android' },
          ],
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.editOpportunity.keywords).toEqual(
      expect.arrayContaining([
        { keyword: 'ios' },
        { keyword: 'webdev' },
        { keyword: 'ps5' },
        { keyword: 'android' },
      ]),
    );

    const afterKeywords = await con
      .getRepository(OpportunityKeyword)
      .findBy({ opportunityId: opportunitiesFixture[0].id });
    expect(afterKeywords.map((k) => k.keyword)).toEqual(
      expect.arrayContaining(['ios', 'webdev', 'ps5', 'android']),
    );
  });

  it('should edit opportunity content without overwriting existing fields', async () => {
    loggedUser = '1';

    const res = await client.mutate(MUTATION, {
      variables: {
        id: opportunitiesFixture[0].id,
        payload: {
          content: {
            requirements: {
              content: 'Updated requirements *italic*',
            },
          },
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.editOpportunity.content).toEqual({
      overview: {
        content: 'We are looking for a Senior Full Stack Developer...',
        html: '<p>We are looking for a Senior Full Stack Developer...</p>',
      },
      requirements: {
        content: 'Updated requirements *italic*',
        html: '<p>Updated requirements <em>italic</em></p>\n',
      },
    });

    const afterContent = await con
      .getRepository(Opportunity)
      .findOneByOrFail({ id: opportunitiesFixture[0].id });
    expect(afterContent.content).toEqual({
      overview: {
        content: 'We are looking for a Senior Full Stack Developer...',
        html: '<p>We are looking for a Senior Full Stack Developer...</p>',
      },
      requirements: {
        content: 'Updated requirements *italic*',
        html: '<p>Updated requirements <em>italic</em></p>\n',
      },
    });
  });

  it('should support partial update without overwriting unspecified content/meta and keywords', async () => {
    loggedUser = '1';

    const before = await con
      .getRepository(Opportunity)
      .findOneByOrFail({ id: opportunitiesFixture[0].id });

    const res = await client.mutate(MUTATION, {
      variables: {
        id: opportunitiesFixture[0].id,
        payload: {
          title: 'Partially Updated Title',
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.editOpportunity.title).toEqual('Partially Updated Title');

    const after = await con
      .getRepository(Opportunity)
      .findOneByOrFail({ id: opportunitiesFixture[0].id });

    expect(after.meta).toEqual(before.meta);
    expect(after.content).toEqual(before.content); // unchanged

    // keywords remain same from previous test
    const keywords = await con
      .getRepository(OpportunityKeyword)
      .findBy({ opportunityId: opportunitiesFixture[0].id });

    expect(keywords.map((k) => k.keyword)).toEqual(
      expect.arrayContaining(['webdev', 'fullstack', 'Fortune 500']),
    );
  });

  it('should edit opportunity questions', async () => {
    loggedUser = '1';

    const res = await client.mutate(MUTATION, {
      variables: {
        id: opportunitiesFixture[0].id,
        payload: {
          questions: [
            {
              title: 'Who are you?',
              placeholder: 'Describe yourself',
            },
            {
              title: 'What is your favorite programming language?',
              placeholder: 'E.g., JavaScript, Python, etc.',
            },
            {
              title: 'Describe a challenging project you worked on.',
              placeholder: null,
            },
          ],
        },
      },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data.editOpportunity.questions).toEqual([
      {
        id: expect.any(String),
        title: 'Who are you?',
        placeholder: 'Describe yourself',
      },
      {
        id: expect.any(String),
        title: 'What is your favorite programming language?',
        placeholder: 'E.g., JavaScript, Python, etc.',
      },
      {
        id: expect.any(String),
        title: 'Describe a challenging project you worked on.',
        placeholder: null,
      },
    ]);

    const afterQuestions = await con.getRepository(QuestionScreening).find({
      where: {
        opportunityId: opportunitiesFixture[0].id,
      },
      order: { questionOrder: 'ASC' },
    });
    expect(afterQuestions).toEqual([
      {
        id: expect.any(String),
        type: QuestionType.Screening,
        opportunityId: opportunitiesFixture[0].id,
        title: 'Who are you?',
        placeholder: 'Describe yourself',
        questionOrder: 0,
      },
      {
        id: expect.any(String),
        type: QuestionType.Screening,
        opportunityId: opportunitiesFixture[0].id,
        title: 'What is your favorite programming language?',
        placeholder: 'E.g., JavaScript, Python, etc.',
        questionOrder: 1,
      },
      {
        id: expect.any(String),
        type: QuestionType.Screening,
        opportunityId: opportunitiesFixture[0].id,
        title: 'Describe a challenging project you worked on.',
        placeholder: null,
        questionOrder: 2,
      },
    ]);
  });

  it('should throw if more then 3 questions are provided', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: opportunitiesFixture[0].id,
          payload: {
            questions: [
              { title: 'Q1' },
              { title: 'Q2' },
              { title: 'Q3' },
              { title: 'Q4' },
            ],
          },
        },
      },
      'ZOD_VALIDATION_ERROR',
      'Validation error',
      (errors) => {
        const extensions = errors[0].extensions as unknown as ZodError;
        expect(extensions.issues.length).toEqual(1);
        expect(extensions.issues[0].code).toEqual('too_big');
        expect(extensions.issues[0].message).toEqual(
          'Too big: expected array to have <=3 items',
        );
        expect(extensions.issues[0].path).toEqual(['questions']);
      },
    );
  });

  it('should upsert existing question by id', async () => {
    loggedUser = '1';

    const question = await con.getRepository(QuestionScreening).save({
      title: 'Test question',
      opportunityId: opportunitiesFixture[0].id,
    });

    const res = await client.mutate(MUTATION, {
      variables: {
        id: opportunitiesFixture[0].id,
        payload: {
          questions: [
            {
              id: question.id,
              title: 'Test question updated',
            },
          ],
        },
      },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data.editOpportunity.questions).toEqual([
      {
        id: question.id,
        title: 'Test question updated',
        placeholder: null,
      },
    ]);

    const afterQuestions = await con.getRepository(QuestionScreening).find({
      where: {
        opportunityId: opportunitiesFixture[0].id,
      },
      order: { questionOrder: 'ASC' },
    });
    expect(afterQuestions).toEqual([
      {
        id: question.id,
        type: QuestionType.Screening,
        opportunityId: opportunitiesFixture[0].id,
        title: 'Test question updated',
        placeholder: null,
        questionOrder: 0,
      },
    ]);
  });

  it('should throw if question provided does not belong to opportunity', async () => {
    loggedUser = '1';

    const question = await con.getRepository(QuestionScreening).save({
      title: 'Test question',
      opportunityId: opportunitiesFixture[1].id,
    });

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: opportunitiesFixture[0].id,
          payload: {
            questions: [{ id: question.id, title: 'Q1' }],
          },
        },
      },
      'CONFLICT',
    );
  });

  it('should avoid query quotes for column keywords', async () => {
    loggedUser = '1';

    const res = await client.mutate(MUTATION, {
      variables: {
        id: opportunitiesFixture[0].id,
        payload: {
          content: {
            requirements: {
              // state is a column in opportunity table so typeorm usually adds quotes breaking the query
              content: 'Test state test',
            },
          },
        },
      },
    });

    expect(res.errors).toBeFalsy();
  });

  it('should throw error when opportunity is not draft', async () => {
    loggedUser = '1';

    await con
      .getRepository(OpportunityJob)
      .update(
        { id: opportunitiesFixture[0].id },
        { state: OpportunityState.LIVE },
      );

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: opportunitiesFixture[0].id,
          payload: { title: 'Does not matter' },
        },
      },
      'CONFLICT',
      'Only opportunities in draft state can be edited',
    );
  });

  it('should edit opportunity with organization data', async () => {
    loggedUser = '1';

    const MUTATION_WITH_ORG = /* GraphQL */ `
      mutation EditOpportunityWithOrg(
        $id: ID!
        $payload: OpportunityEditInput!
      ) {
        editOpportunity(id: $id, payload: $payload) {
          id
          organization {
            id
            website
            description
            perks
            founded
            location
            category
            size
            stage
          }
        }
      }
    `;

    const res = await client.mutate(MUTATION_WITH_ORG, {
      variables: {
        id: opportunitiesFixture[0].id,
        payload: {
          organization: {
            website: 'https://updated.dev',
            description: 'Updated description',
            perks: ['Remote work', 'Flexible hours'],
            founded: 2021,
            location: 'Berlin, Germany',
            category: 'Technology',
            size: CompanySize.COMPANY_SIZE_51_200,
            stage: CompanyStage.SERIES_B,
          },
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.editOpportunity.organization).toMatchObject({
      website: 'https://updated.dev',
      description: 'Updated description',
      perks: ['Remote work', 'Flexible hours'],
      founded: 2021,
      location: 'Berlin, Germany',
      category: 'Technology',
      size: CompanySize.COMPANY_SIZE_51_200,
      stage: CompanyStage.SERIES_B,
    });

    // Verify the organization was updated in database
    const organization = await con
      .getRepository(Organization)
      .findOneBy({ id: organizationsFixture[0].id });

    expect(organization).toMatchObject({
      website: 'https://updated.dev',
      description: 'Updated description',
      perks: ['Remote work', 'Flexible hours'],
      founded: 2021,
      location: 'Berlin, Germany',
      category: 'Technology',
      size: CompanySize.COMPANY_SIZE_51_200,
      stage: CompanyStage.SERIES_B,
    });
  });

  it('should update recruiter title and bio', async () => {
    loggedUser = '1'; // user 1 is recruiter for opportunitiesFixture[0]

    const res = await client.mutate(MUTATION, {
      variables: {
        id: opportunitiesFixture[0].id,
        payload: {
          recruiter: {
            userId: usersFixture[0].id,
            title: 'Senior Tech Recruiter',
            bio: 'Passionate about connecting great talent with amazing opportunities.',
          },
        },
      },
    });

    expect(res.errors).toBeFalsy();

    // Verify the user's title and bio were updated
    const userAfter = await con
      .getRepository(User)
      .findOneBy({ id: usersFixture[0].id });

    expect(userAfter?.title).toBe('Senior Tech Recruiter');
    expect(userAfter?.bio).toBe(
      'Passionate about connecting great talent with amazing opportunities.',
    );
  });

  it('should fail to update recruiter when user is not a recruiter for the opportunity', async () => {
    loggedUser = '1'; // user 1 is recruiter for opportunitiesFixture[0]

    // user 2 is NOT a recruiter for opportunitiesFixture[0]
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: opportunitiesFixture[0].id,
          payload: {
            recruiter: {
              userId: usersFixture[1].id, // user 2
              title: 'Unauthorized Recruiter',
              bio: 'This should fail',
            },
          },
        },
      },
      'FORBIDDEN',
      'Access denied! Recruiter is not part of this opportunity',
    );
  });

  it('should fail to update recruiter when recruiter does not exist in opportunity_user', async () => {
    loggedUser = '1';

    // user 3 exists but is not a recruiter for opportunitiesFixture[0]
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: opportunitiesFixture[0].id,
          payload: {
            recruiter: {
              userId: '3',
              title: 'Non-existent Recruiter',
              bio: 'This should fail',
            },
          },
        },
      },
      'FORBIDDEN',
      'Access denied! Recruiter is not part of this opportunity',
    );
  });

  it('should only update title when bio is not provided', async () => {
    loggedUser = '1';

    // Set initial bio
    await con.getRepository(User).update(
      { id: usersFixture[0].id },
      {
        title: 'Initial Title',
        bio: 'Initial bio that should remain',
      },
    );

    const res = await client.mutate(MUTATION, {
      variables: {
        id: opportunitiesFixture[0].id,
        payload: {
          recruiter: {
            userId: usersFixture[0].id,
            title: 'Updated Title Only',
          },
        },
      },
    });

    expect(res.errors).toBeFalsy();

    const userAfter = await con
      .getRepository(User)
      .findOneBy({ id: usersFixture[0].id });

    expect(userAfter?.title).toBe('Updated Title Only');
    expect(userAfter?.bio).toBe('Initial bio that should remain');
  });

  it('should create organization for opportunity if missing', async () => {
    loggedUser = '1';

    const MUTATION_WITH_ORG = /* GraphQL */ `
      mutation EditOpportunityWithOrg(
        $id: ID!
        $payload: OpportunityEditInput!
      ) {
        editOpportunity(id: $id, payload: $payload) {
          id
          organization {
            id
            name
            website
            description
            perks
            founded
            location
            category
            size
            stage
          }
        }
      }
    `;

    const opportunityWithoutOrganization = await con
      .getRepository(OpportunityJob)
      .save({
        ...opportunitiesFixture[0],
        id: randomUUID(),
        state: OpportunityState.DRAFT,
        organizationId: null,
      });

    await con.getRepository(OpportunityUser).save({
      opportunityId: opportunityWithoutOrganization.id,
      userId: loggedUser,
      type: OpportunityUserType.Recruiter,
    });

    const organizationBefore = await con.getRepository(Organization).findOne({
      where: {
        name: 'Test Corp',
      },
    });

    expect(organizationBefore).toBeNull();

    const res = await client.mutate(MUTATION_WITH_ORG, {
      variables: {
        id: opportunityWithoutOrganization.id,
        payload: {
          organization: {
            name: 'Test Corp',
            website: 'https://updated.dev',
            description: 'Updated description',
            perks: ['Remote work', 'Flexible hours'],
            founded: 2021,
            location: 'Berlin, Germany',
            category: 'Technology',
            size: CompanySize.COMPANY_SIZE_51_200,
            stage: CompanyStage.SERIES_B,
          },
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.editOpportunity.organization).toMatchObject({
      name: 'Test Corp',
      website: 'https://updated.dev',
      description: 'Updated description',
      perks: ['Remote work', 'Flexible hours'],
      founded: 2021,
      location: 'Berlin, Germany',
      category: 'Technology',
      size: CompanySize.COMPANY_SIZE_51_200,
      stage: CompanyStage.SERIES_B,
    });

    // Verify the organization was created in database
    const organization = await con
      .getRepository(Organization)
      .findOneBy({ id: res.data.editOpportunity.organization.id });

    expect(organization).toMatchObject({
      name: 'Test Corp',
      website: 'https://updated.dev',
      description: 'Updated description',
      perks: ['Remote work', 'Flexible hours'],
      founded: 2021,
      location: 'Berlin, Germany',
      category: 'Technology',
      size: CompanySize.COMPANY_SIZE_51_200,
      stage: CompanyStage.SERIES_B,
    });

    const opportunityAfter = await con
      .getRepository(OpportunityJob)
      .findOneBy({ id: opportunityWithoutOrganization.id });

    expect(opportunityAfter!.organizationId).toBe(
      res.data.editOpportunity.organization.id,
    );
  });

  it('should not update organization name on edit', async () => {
    loggedUser = '1';

    const MUTATION_WITH_ORG = /* GraphQL */ `
      mutation EditOpportunityWithOrg(
        $id: ID!
        $payload: OpportunityEditInput!
      ) {
        editOpportunity(id: $id, payload: $payload) {
          id
          organization {
            id
            name
          }
        }
      }
    `;

    const res = await client.mutate(MUTATION_WITH_ORG, {
      variables: {
        id: opportunitiesFixture[0].id,
        payload: {
          organization: {
            name: 'Test update name',
          },
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.editOpportunity.organization.name).toEqual(
      organizationsFixture[0].name,
    );

    // Verify the organization was updated in database
    const organization = await con
      .getRepository(Organization)
      .findOneBy({ id: organizationsFixture[0].id });

    expect(organization!.name).toEqual(organizationsFixture[0].name);
  });

  it('should not allow duplicate organization names', async () => {
    loggedUser = '1';

    const MUTATION_WITH_ORG = /* GraphQL */ `
      mutation EditOpportunityWithOrg(
        $id: ID!
        $payload: OpportunityEditInput!
      ) {
        editOpportunity(id: $id, payload: $payload) {
          id
          organization {
            id
            name
          }
        }
      }
    `;

    const opportunityWithoutOrganization = await con
      .getRepository(OpportunityJob)
      .save({
        ...opportunitiesFixture[0],
        id: randomUUID(),
        state: OpportunityState.DRAFT,
        organizationId: null,
      });

    await con.getRepository(OpportunityUser).save({
      opportunityId: opportunityWithoutOrganization.id,
      userId: loggedUser,
      type: OpportunityUserType.Recruiter,
    });

    const organizationBefore = await con.getRepository(Organization).findOne({
      where: {
        name: 'Daily Dev Inc',
      },
    });

    expect(organizationBefore).not.toBeNull();

    const res = await client.mutate(MUTATION_WITH_ORG, {
      variables: {
        id: opportunityWithoutOrganization.id,
        payload: {
          organization: {
            name: 'Daily Dev Inc',
            founded: 2021,
          },
        },
      },
    });

    expect(res.errors).toBeTruthy();

    expect(res.errors![0].extensions.code).toEqual('CONFLICT');
    expect(res.errors![0].message).toEqual(
      'Organization with this name already exists',
    );
  });
});

describe('mutation clearOrganizationImage', () => {
  beforeEach(async () => {
    await con.getRepository(OpportunityJob).update(
      {
        id: opportunitiesFixture[0].id,
      },
      {
        state: OpportunityState.DRAFT,
      },
    );
  });

  const MUTATION = /* GraphQL */ `
    mutation ClearOrganizationImage($id: ID!) {
      clearOrganizationImage(id: $id) {
        _
      }
    }
  `;

  it('should require authentication', async () => {
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: opportunitiesFixture[0].id,
        },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should throw error when user is not a recruiter for opportunity', async () => {
    loggedUser = '2';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: opportunitiesFixture[0].id,
        },
      },
      'FORBIDDEN',
      'Access denied!',
    );
  });

  it('should throw error when opportunity does not exist', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: '660e8400-e29b-41d4-a716-446655440999',
        },
      },
      'FORBIDDEN',
    );
  });

  it('should clear organization image', async () => {
    loggedUser = '1';

    // First set an image on the organization
    await con
      .getRepository(Organization)
      .update(
        { id: organizationsFixture[0].id },
        { image: 'https://example.com/old-image.png' },
      );

    // Verify image is set
    let organization = await con
      .getRepository(Organization)
      .findOneBy({ id: organizationsFixture[0].id });
    expect(organization?.image).toBe('https://example.com/old-image.png');

    // Clear the image
    const res = await client.mutate(MUTATION, {
      variables: {
        id: opportunitiesFixture[0].id,
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.clearOrganizationImage).toEqual({ _: true });

    // Verify image was cleared in database
    organization = await con
      .getRepository(Organization)
      .findOneBy({ id: organizationsFixture[0].id });
    expect(organization?.image).toBeNull();
  });

  it('should work with opportunity permissions not direct organization permissions', async () => {
    loggedUser = '3';

    // User 3 is not a recruiter for opportunity 0, but let's make them one
    await saveFixtures(con, OpportunityUser, [
      {
        opportunityId: opportunitiesFixture[0].id,
        userId: '3',
        type: OpportunityUserType.Recruiter,
      },
    ]);

    // Set an image on the organization
    await con
      .getRepository(Organization)
      .update(
        { id: organizationsFixture[0].id },
        { image: 'https://example.com/test-image.png' },
      );

    // Should be able to clear the image through opportunity permissions
    const res = await client.mutate(MUTATION, {
      variables: {
        id: opportunitiesFixture[0].id,
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.clearOrganizationImage).toEqual({ _: true });

    // Verify image was cleared
    const organization = await con
      .getRepository(Organization)
      .findOneBy({ id: organizationsFixture[0].id });
    expect(organization?.image).toBeNull();
  });
});

describe('mutation recommendOpportunityScreeningQuestions', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });

  const MUTATION = /* GraphQL */ `
    mutation RecommendOpportunityScreeningQuestions($id: ID!) {
      recommendOpportunityScreeningQuestions(id: $id) {
        id
        title
        order
        placeholder
        opportunityId
      }
    }
  `;

  it('should require authentication', async () => {
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: opportunitiesFixture[0].id },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should throw error when user is not a recruiter for opportunity', async () => {
    loggedUser = '2';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: opportunitiesFixture[0].id,
        },
      },
      'FORBIDDEN',
      'Access denied!',
    );
  });

  it('should throw error when opportunity already has questions', async () => {
    loggedUser = '1'; // user 1 is recruiter for opportunitiesFixture[0]

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: opportunitiesFixture[0].id },
      },
      'CONFLICT',
    );
  });

  it('should recommend and persist screening questions', async () => {
    loggedUser = '1';

    const opportunity = await con.getRepository(OpportunityJob).save(
      con.getRepository(OpportunityJob).create({
        title: 'Opportunity without questions',
        tldr: 'TLDR',
        state: OpportunityState.DRAFT,
        location: [
          {
            type: LocationType.HYBRID,
            city: 'Varaždin',
            subdivision: 'Varaždinska',
            country: 'Croatia',
          },
        ],
        meta: {
          seniorityLevel: SeniorityLevel.SENIOR,
          employmentType: EmploymentType.PART_TIME,
        },
        content: {
          requirements: { content: 'Requirements', html: '' },
          responsibilities: { content: 'Responsibilities', html: '' },
        },
      }),
    );

    await con.getRepository(OpportunityUser).save({
      opportunityId: opportunity.id,
      userId: '1',
      type: OpportunityUserType.Recruiter,
    });

    let clientSpy: jest.SpyInstance | undefined;

    jest
      .spyOn(gondulModule, 'getGondulClient')
      .mockImplementationOnce((): ServiceClient<typeof GondulService> => {
        const transport = createMockGondulTransport();
        const client = createClient(GondulService, transport);

        clientSpy = jest.spyOn(client, 'screeningQuestions');

        return {
          instance: client,
          garmr: createGarmrMock(),
        };
      });

    const res = await client.mutate(MUTATION, {
      variables: { id: opportunity.id },
    });

    expect(res.errors).toBeFalsy();

    expect(clientSpy).toHaveBeenCalledTimes(1);
    expect(clientSpy).toHaveBeenCalledWith({
      jobOpportunity: `**Location:** HYBRID, Varaždin, Varaždinska, Croatia
**Job Type:** PART_TIME
**Seniority Level:** SENIOR

### Overview ###
TLDR

### Responsibilities ###
Responsibilities

### Requirements ###
Requirements`,
    });

    expect(res.data.recommendOpportunityScreeningQuestions).toHaveLength(3);

    const result: GQLOpportunityScreeningQuestion[] =
      res.data.recommendOpportunityScreeningQuestions;

    expect(result).toHaveLength(3);

    result.forEach((question, index) => {
      expect(question).toEqual({
        id: expect.any(String),
        title: expect.any(String),
        placeholder: null,
        opportunityId: opportunity.id,
        order: index,
      });
    });

    const saved = await con
      .getRepository(QuestionScreening)
      .findBy({ opportunityId: opportunity.id });

    expect(saved).toHaveLength(3);
  });
});

describe('mutation updateOpportunityState', () => {
  const MUTATION = /* GraphQL */ `
    mutation UpdateOpportunityState($id: ID!, $state: ProtoEnumValue!) {
      updateOpportunityState(id: $id, state: $state) {
        _
      }
    }
  `;

  it('should require authentication', async () => {
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: opportunitiesFixture[2].id,
          state: OpportunityState.LIVE,
        },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should throw if user is not a recruiter', async () => {
    loggedUser = '2';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: opportunitiesFixture[2].id,
          state: OpportunityState.LIVE,
        },
      },
      'FORBIDDEN',
    );
  });

  it('should return validation error when required data is missing for LIVE state', async () => {
    loggedUser = '1';

    const opportunity = await con.getRepository(OpportunityJob).save({
      title: 'Test',
      tldr: 'Test',
      state: OpportunityState.DRAFT,
      organizationId: organizationsFixture[0].id,
    });

    await con.getRepository(OpportunityUser).save({
      opportunityId: opportunity.id,
      userId: '1',
      type: OpportunityUserType.Recruiter,
    });

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: opportunity.id,
          state: OpportunityState.LIVE,
        },
      },
      'ZOD_VALIDATION_ERROR',
      undefined,
      (errors) => {
        const extensions = errors[0].extensions as unknown as ZodError;
        const issues = extensions.issues.map((i) => i.path.join('.'));

        expect(issues).toEqual([
          'keywords',
          'meta.employmentType',
          'meta.teamSize',
          'meta.seniorityLevel',
          'meta.roleType',
          'content.overview',
          'content.responsibilities',
          'content.requirements',
          'questions',
          'organization.links.0.socialType',
          'organization.links.1.socialType',
          'organization.links.2.title',
          'organization.links.3.socialType',
        ]);
      },
    );
  });

  it('should update state to LIVE when data is valid', async () => {
    loggedUser = '1';

    const opportunityId = opportunitiesFixture[3].id;

    await con.getRepository(OpportunityUser).save({
      opportunityId,
      userId: '1',
      type: OpportunityUserType.Recruiter,
    });

    await con.getRepository(OpportunityKeyword).save({
      opportunityId,
      keyword: 'typescript',
    });
    await con.getRepository(QuestionScreening).save({
      opportunityId,
      title: 'Tell us about a recent project',
      questionOrder: 0,
    });
    await con.getRepository(Opportunity).update(
      { id: opportunityId },
      {
        content: {
          overview: { content: 'Overview content', html: '' },
          responsibilities: { content: 'Responsibilities content', html: '' },
          requirements: { content: 'Requirements content', html: '' },
        },
      },
    );

    const before = await con
      .getRepository(Opportunity)
      .findOneByOrFail({ id: opportunityId });
    expect(before.state).toBe(OpportunityState.DRAFT);

    const res = await client.mutate(MUTATION, {
      variables: { id: opportunityId, state: OpportunityState.LIVE },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.updateOpportunityState).toEqual({ _: true });

    const after = await con
      .getRepository(Opportunity)
      .findOneByOrFail({ id: opportunityId });
    expect(after.state).toBe(OpportunityState.LIVE);
  });

  it('should throw conflict on LIVE transition if opportunity is CLOSED', async () => {
    loggedUser = '1';

    const opportunityId = opportunitiesFixture[0].id; // already LIVE
    await con.getRepository(OpportunityUser).save({
      opportunityId,
      userId: '1',
      type: OpportunityUserType.Recruiter,
    });

    await con.getRepository(Opportunity).save({
      id: opportunityId,
      state: OpportunityState.CLOSED,
    });

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: opportunityId, state: OpportunityState.LIVE },
      },
      'CONFLICT',
      'Opportunity is closed',
    );
  });

  it('should throw conflict on LIVE transition if opportunity does not have organization', async () => {
    loggedUser = '1';

    const opportunityId = opportunitiesFixture[0].id;

    await con.getRepository(OpportunityUser).save({
      opportunityId,
      userId: '1',
      type: OpportunityUserType.Recruiter,
    });

    await con.getRepository(Opportunity).save({
      id: opportunityId,
      state: OpportunityState.DRAFT,
      organizationId: null,
    });

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: opportunityId, state: OpportunityState.LIVE },
      },
      'CONFLICT',
      'Opportunity must have an organization assigned',
    );
  });
});

describe('mutation parseOpportunity', () => {
  const MUTATION = /* GraphQL */ `
    mutation ParseOpportunity($payload: ParseOpportunityInput!) {
      parseOpportunity(payload: $payload) {
        id
        title
        tldr
        content {
          overview {
            content
            html
          }
          requirements {
            content
            html
          }
          responsibilities {
            content
            html
          }
          whatYoullDo {
            content
            html
          }
          interviewProcess {
            content
            html
          }
        }
        meta {
          roleType
          teamSize
          seniorityLevel
          employmentType
          salary {
            min
            max
            period
          }
        }
        location {
          city
          country
          subdivision
          type
        }
        keywords {
          keyword
        }
        questions {
          id
          title
          placeholder
        }
        feedbackQuestions {
          title
          placeholder
        }
      }
    }
  `;

  beforeEach(async () => {
    jest.clearAllMocks();

    await deleteKeysByPattern(`${rateLimiterName}:*`);

    const transport = createMockBrokkrTransport();

    const serviceClient = {
      instance: createClient(BrokkrService, transport),
      garmr: createGarmrMock(),
    };

    jest
      .spyOn(brokkrCommon, 'getBrokkrClient')
      .mockImplementation((): ServiceClient<typeof BrokkrService> => {
        return serviceClient;
      });
  });

  it('should parse opportunity from file', async () => {
    trackingId = 'anon1';

    fileTypeFromBuffer.mockResolvedValue({
      ext: 'pdf',
      mime: 'application/pdf',
    });

    const uploadResumeFromBufferSpy = jest.spyOn(
      googleCloud,
      'uploadResumeFromBuffer',
    );

    uploadResumeFromBufferSpy.mockResolvedValue(
      `https://storage.cloud.google.com/${RESUME_BUCKET_NAME}/file`,
    );

    const deleteFileFromBucketSpy = jest.spyOn(
      googleCloud,
      'deleteFileFromBucket',
    );

    deleteFileFromBucketSpy.mockResolvedValue(true);

    // Execute the mutation with a file upload
    const res = await authorizeRequest(
      request(app.server)
        .post('/graphql')
        .field(
          'operations',
          JSON.stringify({
            query: MUTATION,
            variables: {
              payload: {
                file: null,
              },
            },
          }),
        )
        .field('map', JSON.stringify({ '0': ['variables.payload.file'] }))
        .attach('0', './__tests__/fixture/screen.pdf'),
    ).expect(200);

    const body = res.body;
    expect(body.errors).toBeFalsy();

    expect(body.data.parseOpportunity).toMatchObject({
      title: 'Mocked Opportunity Title',
      tldr: 'This is a mocked TL;DR of the opportunity.',
      keywords: [
        { keyword: 'mock' },
        { keyword: 'opportunity' },
        { keyword: 'test' },
      ],
      meta: {
        employmentType: EmploymentType.FULL_TIME,
        seniorityLevel: SeniorityLevel.SENIOR,
        roleType: RoleType.Auto,
        salary: {
          min: 1000,
          max: 2000,
          period: SalaryPeriod.MONTHLY,
        },
      },
      content: {
        overview: {
          content: 'This is the overview of the mocked opportunity.',
          html: '<p>This is the overview of the mocked opportunity.</p>\n',
        },
        responsibilities: {
          content: 'These are the responsibilities of the mocked opportunity.',
          html: '<p>These are the responsibilities of the mocked opportunity.</p>\n',
        },
        requirements: {
          content: 'These are the requirements of the mocked opportunity.',
          html: '<p>These are the requirements of the mocked opportunity.</p>\n',
        },
      },
      location: [
        {
          city: 'San Francisco',
          country: 'USA',
          subdivision: 'CA',
          type: LocationType.REMOTE,
        },
      ],
      questions: [],
      feedbackQuestions: [
        {
          title: 'Why did you reject this opportunity?',
          placeholder: `E.g., Not interested in the tech stack, location doesn't work for me, compensation too low...`,
        },
      ],
    });

    const opportunity = await con.getRepository(OpportunityJob).findOne({
      where: {
        id: body.data.parseOpportunity.id,
      },
    });

    expect(opportunity).toBeDefined();
    expect(opportunity!.state).toBe(OpportunityState.DRAFT);
  });

  it('should parse opportunity from URL', async () => {
    trackingId = 'anon1';

    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    const pdfResponse = new Response('Mocked fetch response body', {
      status: 200,
      headers: { 'Content-Type': 'application/pdf' },
    });

    jest
      .spyOn(pdfResponse, 'arrayBuffer')
      .mockResolvedValue(new ArrayBuffer(0));

    fetchSpy.mockResolvedValueOnce(pdfResponse);

    fileTypeFromBuffer.mockResolvedValue({
      ext: 'pdf',
      mime: 'application/pdf',
    });

    const uploadResumeFromBufferSpy = jest.spyOn(
      googleCloud,
      'uploadResumeFromBuffer',
    );

    uploadResumeFromBufferSpy.mockResolvedValue(
      `https://storage.cloud.google.com/${RESUME_BUCKET_NAME}/file`,
    );

    const deleteFileFromBucketSpy = jest.spyOn(
      googleCloud,
      'deleteFileFromBucket',
    );

    deleteFileFromBucketSpy.mockResolvedValue(true);

    // Execute the mutation with a URL
    const res = await authorizeRequest(
      request(app.server)
        .post('/graphql')
        .send({
          query: MUTATION,
          variables: {
            payload: {
              url: 'https://example.com/opportunity',
            },
          },
        }),
    ).expect(200);

    const body = res.body;
    expect(body.errors).toBeFalsy();

    expect(body.data.parseOpportunity).toMatchObject({
      title: 'Mocked Opportunity Title',
      tldr: 'This is a mocked TL;DR of the opportunity.',
      keywords: [
        { keyword: 'mock' },
        { keyword: 'opportunity' },
        { keyword: 'test' },
      ],
      meta: {
        employmentType: EmploymentType.FULL_TIME,
        seniorityLevel: SeniorityLevel.SENIOR,
        roleType: RoleType.Auto,
        salary: {
          min: 1000,
          max: 2000,
          period: SalaryPeriod.MONTHLY,
        },
      },
      content: {
        overview: {
          content: 'This is the overview of the mocked opportunity.',
          html: '<p>This is the overview of the mocked opportunity.</p>\n',
        },
        responsibilities: {
          content: 'These are the responsibilities of the mocked opportunity.',
          html: '<p>These are the responsibilities of the mocked opportunity.</p>\n',
        },
        requirements: {
          content: 'These are the requirements of the mocked opportunity.',
          html: '<p>These are the requirements of the mocked opportunity.</p>\n',
        },
      },
      location: [
        {
          city: 'San Francisco',
          country: 'USA',
          subdivision: 'CA',
          type: LocationType.REMOTE,
        },
      ],
      questions: [],
    });
  });

  it('should fail when both file and URL are provided', async () => {
    trackingId = 'anon1';

    const res = await authorizeRequest(
      request(app.server)
        .post('/graphql')
        .field(
          'operations',
          JSON.stringify({
            query: MUTATION,
            variables: {
              payload: {
                file: null,
                url: 'https://example.com/opportunity',
              },
            },
          }),
        )
        .field('map', JSON.stringify({ '0': ['variables.payload.file'] }))
        .attach('0', './__tests__/fixture/screen.pdf'),
    ).expect(200);

    const body = res.body;
    expect(body.errors).toBeDefined();
    expect(body.errors[0].extensions.code).toBe('ZOD_VALIDATION_ERROR');
    expect(body.errors[0].extensions.issues[0].message).toEqual(
      'Only one of url or file can be provided.',
    );
  });

  it('should fail when neither file nor URL are provided', async () => {
    trackingId = 'anon1';

    const res = await authorizeRequest(
      request(app.server)
        .post('/graphql')
        .send({
          query: MUTATION,
          variables: {
            payload: {},
          },
        }),
    ).expect(200);

    const body = res.body;
    expect(body.errors).toBeDefined();
    expect(body.errors[0].extensions.code).toBe('ZOD_VALIDATION_ERROR');
    expect(body.errors[0].extensions.issues[0].message).toEqual(
      'Either url or file must be provided.',
    );
  });

  it('should fail if invalid file type is provided', async () => {
    trackingId = 'anon1';

    fileTypeFromBuffer.mockResolvedValue({
      ext: 'exe',
      mime: 'application/x-msdownload',
    });

    const res = await authorizeRequest(
      request(app.server)
        .post('/graphql')
        .field(
          'operations',
          JSON.stringify({
            query: MUTATION,
            variables: {
              payload: {
                file: null,
              },
            },
          }),
        )
        .field('map', JSON.stringify({ '0': ['variables.payload.file'] }))
        .attach('0', './__tests__/fixture/screen.pdf'),
    ).expect(200);

    const body = res.body;
    expect(body.errors).toBeDefined();
    expect(body.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED');
    expect(body.errors[0].message).toBe('File type not supported');
  });

  it('should not allow authenticated users to parse opportunity', async () => {
    loggedUser = '1';

    const res = await client.mutate(MUTATION, {
      variables: {
        payload: {
          url: 'https://example.com/opportunity',
        },
      },
    });

    expect(res.errors).toBeDefined();
    expect(res.errors?.[0].extensions.code).toBe('FORBIDDEN');
    expect(res.errors?.[0].message).toBe(
      'Not available for authenticated users yet',
    );
  });
});

describe('mutation createSharedSlackChannel', () => {
  const MUTATION = /* GraphQL */ `
    mutation CreateSharedSlackChannel($email: String!, $channelName: String!) {
      createSharedSlackChannel(email: $email, channelName: $channelName) {
        _
      }
    }
  `;

  beforeEach(() => {
    // Reset all mocks before each test
    mockConversationsCreate.mockReset();
    mockConversationsInviteShared.mockReset();
  });

  it('should require authentication', async () => {
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          email: 'user@example.com',
          channelName: 'test-channel',
        },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should forbid non-recruiters from creating slack channels', async () => {
    loggedUser = '5'; // User 5 is not a recruiter in fixtures

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          email: 'user@example.com',
          channelName: 'test-channel',
        },
      },
      'FORBIDDEN',
    );
  });

  it('should create slack channel and invite user successfully', async () => {
    loggedUser = '1';

    // Create a recruiter record for the logged-in user
    await con.getRepository(OpportunityUserRecruiter).save({
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '1',
      type: OpportunityUserType.Recruiter,
    });

    // Mock successful Slack API responses
    mockConversationsCreate.mockResolvedValue({
      ok: true,
      channel: {
        id: 'C1234567890',
        name: 'test-channel',
      },
    });

    mockConversationsInviteShared.mockResolvedValue({
      ok: true,
    });

    const res = await client.mutate(MUTATION, {
      variables: {
        email: 'user@example.com',
        channelName: 'test-channel',
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.createSharedSlackChannel).toEqual({ _: true });

    // Verify Slack API calls were made
    expect(mockConversationsCreate).toHaveBeenCalledWith({
      name: 'test-channel',
      is_private: false,
    });
    expect(mockConversationsInviteShared).toHaveBeenCalledWith({
      channel: 'C1234567890',
      emails: ['user@example.com'],
      external_limited: true,
    });
  });

  it('should handle slack channel creation failure', async () => {
    loggedUser = '1';

    // Create a recruiter record for the logged-in user
    await con.getRepository(OpportunityUserRecruiter).save({
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '1',
      type: OpportunityUserType.Recruiter,
    });

    // Mock failed channel creation (no channel in response)
    mockConversationsCreate.mockResolvedValue({
      ok: false,
      error: 'name_taken',
      channel: undefined,
    });

    const res = await client.mutate(MUTATION, {
      variables: {
        email: 'user@example.com',
        channelName: 'existing-channel',
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.createSharedSlackChannel).toEqual({ _: false });

    // Should not proceed to invite if channel creation fails
    expect(mockConversationsInviteShared).not.toHaveBeenCalled();
  });

  it('should handle invitation failure', async () => {
    loggedUser = '1';

    // Create a recruiter record for the logged-in user
    await con.getRepository(OpportunityUserRecruiter).save({
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '1',
      type: OpportunityUserType.Recruiter,
    });

    mockConversationsCreate.mockResolvedValue({
      ok: true,
      channel: {
        id: 'C1234567890',
        name: 'test-channel',
      },
    });

    mockConversationsInviteShared.mockRejectedValue(
      new Error('Failed to invite user'),
    );

    const res = await client.mutate(MUTATION, {
      variables: {
        email: 'user@example.com',
        channelName: 'test-channel',
      },
    });

    expect(res.errors).toBeTruthy();
  });
});
