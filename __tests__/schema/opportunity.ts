import { DataSource, IsNull } from 'typeorm';
import { User, Keyword, Alerts } from '../../src/entity';
import { Opportunity } from '../../src/entity/opportunities/Opportunity';
import { OpportunityMatch } from '../../src/entity/OpportunityMatch';
import { Organization } from '../../src/entity/Organization';
import { OpportunityKeyword } from '../../src/entity/OpportunityKeyword';
import createOrGetConnection from '../../src/db';
import {
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
} from '@dailydotdev/schema';
import { UserCandidatePreference } from '../../src/entity/user/UserCandidatePreference';
import { QuestionScreening } from '../../src/entity/questions/QuestionScreening';
import type { GQLOpportunity } from '../../src/schema/opportunity';
import { UserCandidateKeyword } from '../../src/entity/user/UserCandidateKeyword';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string = null;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser),
  );
  client = state.client;
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

  it('should return null for non-live opportunity', async () => {
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
          blob
          contentType
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
          bucket: 'bucket-name',
          lastModified: new Date('2023-10-10T10:00:00Z'),
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
        blob: '1',
        contentType: 'application/pdf',
        lastModified: '2023-10-10T10:00:00.000Z',
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
        blob: null,
        contentType: null,
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
        blob: null,
        contentType: null,
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

    const errors = res.errors[0].extensions.issues.map((issue) => [
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

    const errors = res.errors[0].extensions.issues.map((issue) => [
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
        expect(errors[0].extensions.issues.length).toEqual(1);
        expect(errors[0].extensions.issues[0].code).toEqual('custom');
        expect(errors[0].extensions.issues[0].message).toEqual(
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

describe('mutation candidateAddKeyword', () => {
  const MUTATION = /* GraphQL */ `
    mutation CandidateAddKeyword($keyword: String!) {
      candidateAddKeyword(keyword: $keyword) {
        _
      }
    }
  `;

  it('should require authentication', async () => {
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { keyword: 'NewKeyword' },
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
      variables: { keyword: '  NewKeyword  ' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.candidateAddKeyword).toEqual({ _: true });

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
      variables: { keyword: '  ExistingKeyword  ' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.candidateAddKeyword).toEqual({ _: true });

    expect(
      await con.getRepository(UserCandidateKeyword).findBy({ userId: '1' }),
    ).toEqual([
      {
        userId: '1',
        keyword: 'ExistingKeyword',
      },
    ]);
  });

  it('should return error on empty keyword', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { keyword: '   ' },
      },
      'ZOD_VALIDATION_ERROR',
      'Zod validation error',
      (errors) => {
        expect(errors[0].extensions.issues.length).toEqual(1);
        expect(errors[0].extensions.issues[0].code).toEqual('too_small');
        expect(errors[0].extensions.issues[0].message).toEqual(
          'Keyword cannot be empty',
        );
      },
    );

    expect(
      await con.getRepository(UserCandidateKeyword).countBy({ userId: '1' }),
    ).toBe(0);
  });
});

describe('mutation candidateRemoveKeyword', () => {
  const MUTATION = /* GraphQL */ `
    mutation CandidateRemoveKeyword($keyword: String!) {
      candidateRemoveKeyword(keyword: $keyword) {
        _
      }
    }
  `;

  it('should require authentication', async () => {
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { keyword: 'SomeKeyword' },
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
      variables: { keyword: '   RemoveMe   ' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.candidateRemoveKeyword).toEqual({ _: true });

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
      variables: { keyword: 'NonExistingKeyword' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.candidateRemoveKeyword).toEqual({ _: true });

    expect(
      await con.getRepository(UserCandidateKeyword).countBy({ userId: '1' }),
    ).toBe(0);
  });

  it('should return error on empty keyword', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { keyword: '   ' },
      },
      'ZOD_VALIDATION_ERROR',
      'Zod validation error',
      (errors) => {
        expect(errors[0].extensions.issues.length).toEqual(1);
        expect(errors[0].extensions.issues[0].code).toEqual('too_small');
        expect(errors[0].extensions.issues[0].message).toEqual(
          'Keyword cannot be empty',
        );
      },
    );

    expect(
      await con.getRepository(UserCandidateKeyword).countBy({ userId: '1' }),
    ).toBe(0);
  });
});
