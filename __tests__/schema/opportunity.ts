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
  organizationsFixture,
} from '../fixture/opportunity';
import { OpportunityUser } from '../../src/entity/opportunities/user';
import {
  OpportunityMatchStatus,
  OpportunityUserType,
} from '../../src/entity/opportunities/types';
import {
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
import { deleteRedisKey } from '../../src/redis';
import { rateLimiterName } from '../../src/directive/rateLimit';
import { fileTypeFromBuffer } from '../setup';
import { EMPLOYMENT_AGREEMENT_BUCKET_NAME } from '../../src/config';
import { RoleType } from '../../src/common/schema/userCandidate';
import { QuestionType } from '../../src/entity/questions/types';
import type { FastifyInstance } from 'fastify';
import type { Context } from '../../src/Context';
import { createMockGondulTransport } from '../helpers';
import { createClient } from '@connectrpc/connect';
import { ApplicationService as GondulService } from '@dailydotdev/schema';
import * as gondulModule from '../../src/common/gondul';
import type { ServiceClient } from '../../src/types';
import { OpportunityJob } from '../../src/entity/opportunities/OpportunityJob';

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

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser) as unknown as Context,
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
  ]);
});

describe('query opportunityById', () => {
  const OPPORTUNITY_BY_ID_QUERY = /* GraphQL */ `
    query OpportunityById($id: ID!) {
      opportunityById(id: $id) {
        id
        type
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
    });
  });

  it('should return UNEXPECTED for false UUID opportunity', async () => {
    await testQueryErrorCode(
      client,
      { query: OPPORTUNITY_BY_ID_QUERY, variables: { id: 'non-existing' } },
      'UNEXPECTED',
    );
  });

  it('should return null for non-live opportunity when user is not a recruiter', async () => {
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
      'NOT_FOUND',
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
      opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      type: OpportunityUserType.Recruiter,
    });

    await con
      .getRepository(Opportunity)
      .update(
        { id: '550e8400-e29b-41d4-a716-446655440001' },
        { state: OpportunityState.DRAFT },
      );

    const res = await client.query(OPPORTUNITY_BY_ID_QUERY, {
      variables: { id: '550e8400-e29b-41d4-a716-446655440001' },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data.opportunityById.id).toEqual(
      '550e8400-e29b-41d4-a716-446655440001',
    );
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

  it('should clear alert when alert matches opportunityId', async () => {
    loggedUser = '1';

    await saveFixtures(con, Alerts, [
      {
        userId: '1',
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
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
        opportunityId: '550e8400-e29b-41d4-a716-446655440001',
      }),
    ).toEqual(0);
    expect(
      await con
        .getRepository(Alerts)
        .countBy({ userId: '1', opportunityId: IsNull() }),
    ).toEqual(1);
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
        variables: { id: '550e8400-e29b-41d4-a716-446655440001' },
      },
      'NOT_FOUND',
    );
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
      'Zod validation error',
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

  it('should return error when the opportunity is not live', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: '550e8400-e29b-41d4-a716-446655440003',
        },
      },
      'FORBIDDEN',
      'Access denied! Opportunity is not live',
    );
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
      'Zod validation error',
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
      'Zod validation error',
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
      'Zod validation error',
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
      'Zod validation error',
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
      'Zod validation error',
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
      'Zod validation error',
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
    expect(body.errors[0].message).toEqual('Zod validation error');
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
    expect(body.errors[0].message).toEqual('Zod validation error');
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
    expect(body.errors[0].message).toEqual('Zod validation error');
    expect(body.errors[0].extensions.code).toEqual('ZOD_VALIDATION_ERROR');
    expect(extensions.issues[0].code).toEqual('custom');
    expect(extensions.issues[0].message).toEqual(
      'File content does not match file extension',
    );
    expect(extensions.issues[0].path).toEqual(['file', 'buffer']);
  });
});

describe('mutation editOpportunity', () => {
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
      'Zod validation error',
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
          'questions',
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
});
