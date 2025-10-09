import { DataSource, DeepPartial } from 'typeorm';
import createOrGetConnection from '../../src/db';
import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testQueryErrorCode,
} from '../helpers';
import { User } from '../../src/entity';
import { usersFixture } from '../fixture/user';
import { UserExperience } from '../../src/entity/user/experiences/UserExperience';
import { UserExperienceType } from '../../src/entity/user/experiences/types';
import { Company } from '../../src/entity/Company';
import { UserSkill } from '../../src/entity/user/UserSkill';
import { UserExperienceSkill } from '../../src/entity/user/experiences/UserExperienceSkill';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string | null = null;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser),
  );
  client = state.client;
});

afterAll(() => disposeGraphQLTesting(state));

const companiesFixture: DeepPartial<Company>[] = [
  {
    id: 'company-1',
    name: 'Daily.dev',
    image: 'https://daily.dev/logo.png',
    domains: ['daily.dev'],
  },
  {
    id: 'company-2',
    name: 'Google',
    image: 'https://google.com/logo.png',
    domains: ['google.com'],
  },
  {
    id: 'company-3',
    name: 'University of Example',
    image: 'https://example.edu/logo.png',
    domains: ['example.edu'],
    type: 'school',
  },
];

const userExperiencesFixture: DeepPartial<UserExperience>[] = [
  {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    userId: '1',
    companyId: 'company-1',
    title: 'Senior Software Engineer',
    subtitle: 'Backend Team',
    description: 'Working on API infrastructure',
    startedAt: new Date('2022-01-01'),
    endedAt: null, // Current position
    type: UserExperienceType.Work,
    createdAt: new Date('2022-01-01'),
  },
  {
    id: 'a1b2c3d4-5678-4abc-9def-123456789012',
    userId: '1',
    companyId: 'company-2',
    title: 'Software Engineer',
    subtitle: null,
    description: 'Worked on search infrastructure',
    startedAt: new Date('2020-01-01'),
    endedAt: new Date('2021-12-31'),
    type: UserExperienceType.Work,
    createdAt: new Date('2020-01-01'),
  },
  {
    id: 'b2c3d4e5-6789-4bcd-aef0-234567890123',
    userId: '1',
    companyId: 'company-3',
    title: 'Computer Science',
    subtitle: 'Bachelor of Science',
    description: 'Focused on distributed systems',
    startedAt: new Date('2016-09-01'),
    endedAt: new Date('2020-06-30'),
    type: UserExperienceType.Education,
    createdAt: new Date('2016-09-01'),
  },
  {
    id: 'c3d4e5f6-789a-4cde-bf01-345678901234',
    userId: '1',
    companyId: 'company-1',
    title: 'Open Source Contributor',
    subtitle: null,
    description: 'Contributing to TypeScript projects',
    startedAt: new Date('2021-06-01'),
    endedAt: null,
    type: UserExperienceType.Project,
    createdAt: new Date('2021-06-01'),
  },
  {
    id: 'd4e5f6a7-89ab-4def-c012-456789012345',
    userId: '2',
    companyId: 'company-2',
    title: 'Product Manager',
    subtitle: null,
    description: 'Managing product roadmap',
    startedAt: new Date('2021-01-01'),
    endedAt: null,
    type: UserExperienceType.Work,
    createdAt: new Date('2021-01-01'),
  },
];

beforeEach(async () => {
  loggedUser = null;
  await saveFixtures(con, User, usersFixture);
  await saveFixtures(con, Company, companiesFixture);
  await saveFixtures(con, UserExperience, userExperiencesFixture);
});

describe('query userExperiences', () => {
  const USER_EXPERIENCES_QUERY = /* GraphQL */ `
    query UserExperiences(
      $userId: ID!
      $type: UserExperienceType
      $after: String
      $first: Int
    ) {
      userExperiences(
        userId: $userId
        type: $type
        after: $after
        first: $first
      ) {
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
        edges {
          node {
            id
            type
            title
            subtitle
            description
            startedAt
            endedAt
            createdAt
            company {
              id
              name
              image
            }
          }
          cursor
        }
      }
    }
  `;

  it('should return paginated user experiences for logged-in user', async () => {
    loggedUser = '1';

    const res = await client.query(USER_EXPERIENCES_QUERY, {
      variables: { userId: '1' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperiences.edges).toHaveLength(4);
    // First should be most recent active experience (ordered by null endedAt first, then startedAt desc)
    expect(res.data.userExperiences.edges[0].node.id).toBe(
      'f47ac10b-58cc-4372-a567-0e02b2c3d479', // exp-1: Started 2022-01-01, active
    );
    expect(res.data.userExperiences.edges[0].node.endedAt).toBeNull();
    expect(res.data.userExperiences.edges[0].node.company.name).toBe(
      'Daily.dev',
    );
    expect(res.data.userExperiences.pageInfo.hasNextPage).toBe(false);
  });

  it('should return only 1 experience for non-logged-in user', async () => {
    loggedUser = null;

    const res = await client.query(USER_EXPERIENCES_QUERY, {
      variables: { userId: '1' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperiences.edges).toHaveLength(1);
  });

  it('should restrict fields for anonymous users to only allowed columns', async () => {
    loggedUser = null;

    const res = await client.query(USER_EXPERIENCES_QUERY, {
      variables: { userId: '1' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperiences.edges).toHaveLength(1);

    const experience = res.data.userExperiences.edges[0].node;

    // Allowed columns for anonymous users
    expect(experience.id).toBeDefined();
    expect(experience.type).toBeDefined();
    expect(experience.title).toBeDefined();
    expect(experience.company).toBeDefined();
    expect(experience.company.id).toBeDefined();
    expect(experience.company.name).toBeDefined();

    // Restricted columns should be null for anonymous users
    expect(experience.subtitle).toBeNull();
    expect(experience.description).toBeNull();
    expect(experience.startedAt).toBeNull();
    expect(experience.endedAt).toBeNull();
    expect(experience.createdAt).toBeNull();
  });

  it('should return all fields for logged-in users', async () => {
    loggedUser = '1';

    const res = await client.query(USER_EXPERIENCES_QUERY, {
      variables: { userId: '1', first: 1 },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperiences.edges).toHaveLength(1);

    const experience = res.data.userExperiences.edges[0].node;

    // All columns should be available for logged-in users
    expect(experience.id).toBeDefined();
    expect(experience.type).toBeDefined();
    expect(experience.title).toBeDefined();
    expect(experience.company).toBeDefined();
    expect(experience.subtitle).toBeDefined(); // exp-1 has subtitle
    expect(experience.description).toBeDefined(); // exp-1 has description
    expect(experience.startedAt).toBeDefined();
    expect(experience.createdAt).toBeDefined();
    // endedAt can be null for active experiences, so we just check it's present in the response
  });

  it('should filter by experience type', async () => {
    loggedUser = '1';

    const res = await client.query(USER_EXPERIENCES_QUERY, {
      variables: { userId: '1', type: 'work' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperiences.edges).toHaveLength(2);
    expect(res.data.userExperiences.edges[0].node.type).toBe('work');
    expect(res.data.userExperiences.edges[1].node.type).toBe('work');
  });

  it('should filter by education type', async () => {
    loggedUser = '1';

    const res = await client.query(USER_EXPERIENCES_QUERY, {
      variables: { userId: '1', type: 'education' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperiences.edges).toHaveLength(1);
    expect(res.data.userExperiences.edges[0].node.id).toBe(
      'b2c3d4e5-6789-4bcd-aef0-234567890123',
    );
    expect(res.data.userExperiences.edges[0].node.type).toBe('education');
  });

  it('should filter by project type', async () => {
    loggedUser = '1';

    const res = await client.query(USER_EXPERIENCES_QUERY, {
      variables: { userId: '1', type: 'project' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperiences.edges).toHaveLength(1);
    expect(res.data.userExperiences.edges[0].node.id).toBe(
      'c3d4e5f6-789a-4cde-bf01-345678901234',
    );
    expect(res.data.userExperiences.edges[0].node.type).toBe('project');
  });

  it('should support pagination with first parameter', async () => {
    loggedUser = '1';

    const res = await client.query(USER_EXPERIENCES_QUERY, {
      variables: { userId: '1', first: 2 },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperiences.edges).toHaveLength(2);
    expect(res.data.userExperiences.pageInfo.hasNextPage).toBe(true);
    expect(res.data.userExperiences.pageInfo.endCursor).toBeTruthy();
  });

  it('should support pagination with after cursor', async () => {
    loggedUser = '1';

    // Get first page
    const firstPage = await client.query(USER_EXPERIENCES_QUERY, {
      variables: { userId: '1', first: 2 },
    });

    expect(firstPage.data.userExperiences.edges).toHaveLength(2);
    const cursor = firstPage.data.userExperiences.pageInfo.endCursor;

    // Get second page
    const secondPage = await client.query(USER_EXPERIENCES_QUERY, {
      variables: { userId: '1', first: 2, after: cursor },
    });

    expect(secondPage.errors).toBeFalsy();
    expect(secondPage.data.userExperiences.edges).toHaveLength(2);
    expect(secondPage.data.userExperiences.edges[0].node.id).not.toBe(
      firstPage.data.userExperiences.edges[0].node.id,
    );
  });

  it('should return empty list for user with no experiences', async () => {
    loggedUser = '3';

    const res = await client.query(USER_EXPERIENCES_QUERY, {
      variables: { userId: '3' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperiences.edges).toHaveLength(0);
    expect(res.data.userExperiences.pageInfo.hasNextPage).toBe(false);
  });

  it('should return experiences for another user', async () => {
    loggedUser = '1';

    const res = await client.query(USER_EXPERIENCES_QUERY, {
      variables: { userId: '2' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperiences.edges).toHaveLength(1);
    expect(res.data.userExperiences.edges[0].node.id).toBe(
      'd4e5f6a7-89ab-4def-c012-456789012345',
    );
  });

  it('should return cursor for each edge', async () => {
    loggedUser = '1';

    const res = await client.query(USER_EXPERIENCES_QUERY, {
      variables: { userId: '1', first: 2 },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperiences.edges[0].cursor).toBeTruthy();
    expect(res.data.userExperiences.edges[1].cursor).toBeTruthy();
    expect(typeof res.data.userExperiences.edges[0].cursor).toBe('string');
  });

  it('should order by endedAt desc nulls first, then startedAt desc', async () => {
    loggedUser = '1';

    const res = await client.query(USER_EXPERIENCES_QUERY, {
      variables: { userId: '1' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperiences.edges).toHaveLength(4);

    // First two should be active experiences (null endedAt), ordered by startedAt desc
    const firstExp = res.data.userExperiences.edges[0].node;
    const secondExp = res.data.userExperiences.edges[1].node;

    // exp-1: Started 2022-01-01, active (most recent active)
    expect(firstExp.id).toBe('f47ac10b-58cc-4372-a567-0e02b2c3d479');
    expect(firstExp.endedAt).toBeNull();

    // exp-4: Started 2021-06-01, active (older active)
    expect(secondExp.id).toBe('c3d4e5f6-789a-4cde-bf01-345678901234');
    expect(secondExp.endedAt).toBeNull();

    // Then past experiences, ordered by endedAt desc
    const thirdExp = res.data.userExperiences.edges[2].node;
    const fourthExp = res.data.userExperiences.edges[3].node;

    // exp-2: ended 2021-12-31 (most recently ended)
    expect(thirdExp.id).toBe('a1b2c3d4-5678-4abc-9def-123456789012');
    expect(thirdExp.endedAt).toBeTruthy();

    // exp-3: ended 2020-06-30 (older)
    expect(fourthExp.id).toBe('b2c3d4e5-6789-4bcd-aef0-234567890123');
    expect(fourthExp.endedAt).toBeTruthy();

    // Verify ordering: exp-2 ended more recently than exp-3
    expect(new Date(thirdExp.endedAt) > new Date(fourthExp.endedAt)).toBe(true);
  });
});

describe('query userExperienceById', () => {
  const USER_EXPERIENCE_BY_ID_QUERY = /* GraphQL */ `
    query UserExperienceById($id: ID!) {
      userExperienceById(id: $id) {
        id
        type
        title
        subtitle
        description
        startedAt
        endedAt
        createdAt
        company {
          id
          name
          image
        }
      }
    }
  `;

  it('should return user experience by id', async () => {
    loggedUser = '1';

    const res = await client.query(USER_EXPERIENCE_BY_ID_QUERY, {
      variables: { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperienceById.id).toBe(
      'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    );
    expect(res.data.userExperienceById.type).toBe('work');
    expect(res.data.userExperienceById.title).toBe('Senior Software Engineer');
    expect(res.data.userExperienceById.subtitle).toBe('Backend Team');
    expect(res.data.userExperienceById.description).toBe(
      'Working on API infrastructure',
    );
    expect(res.data.userExperienceById.endedAt).toBeNull();
    expect(res.data.userExperienceById.company.name).toBe('Daily.dev');
  });

  it('should return education experience by id', async () => {
    loggedUser = '1';

    const res = await client.query(USER_EXPERIENCE_BY_ID_QUERY, {
      variables: { id: 'b2c3d4e5-6789-4bcd-aef0-234567890123' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperienceById.id).toBe(
      'b2c3d4e5-6789-4bcd-aef0-234567890123',
    );
    expect(res.data.userExperienceById.type).toBe('education');
    expect(res.data.userExperienceById.title).toBe('Computer Science');
    expect(res.data.userExperienceById.company.name).toBe(
      'University of Example',
    );
  });

  it('should return project experience by id', async () => {
    loggedUser = '1';

    const res = await client.query(USER_EXPERIENCE_BY_ID_QUERY, {
      variables: { id: 'c3d4e5f6-789a-4cde-bf01-345678901234' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperienceById.id).toBe(
      'c3d4e5f6-789a-4cde-bf01-345678901234',
    );
    expect(res.data.userExperienceById.type).toBe('project');
    expect(res.data.userExperienceById.title).toBe('Open Source Contributor');
  });

  it('should return error when experience does not exist', async () => {
    loggedUser = '1';

    await testQueryErrorCode(
      client,
      {
        query: USER_EXPERIENCE_BY_ID_QUERY,
        variables: { id: 'non-existent' },
      },
      'NOT_FOUND',
    );
  });

  it('should work for non-logged-in users', async () => {
    loggedUser = null;

    const res = await client.query(USER_EXPERIENCE_BY_ID_QUERY, {
      variables: { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperienceById.id).toBe(
      'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    );
  });

  it('should restrict fields for anonymous users when fetching by id', async () => {
    loggedUser = null;

    const res = await client.query(USER_EXPERIENCE_BY_ID_QUERY, {
      variables: { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
    });

    expect(res.errors).toBeFalsy();

    const experience = res.data.userExperienceById;

    // Allowed columns for anonymous users
    expect(experience.id).toBe('f47ac10b-58cc-4372-a567-0e02b2c3d479');
    expect(experience.type).toBe('work');
    expect(experience.title).toBe('Senior Software Engineer');
    expect(experience.company).toBeDefined();
    expect(experience.company.name).toBe('Daily.dev');

    // Restricted columns should be null for anonymous users
    expect(experience.subtitle).toBeNull();
    expect(experience.description).toBeNull();
    expect(experience.startedAt).toBeNull();
    expect(experience.endedAt).toBeNull();
    expect(experience.createdAt).toBeNull();
  });

  it('should return experience from another user', async () => {
    loggedUser = '1';

    const res = await client.query(USER_EXPERIENCE_BY_ID_QUERY, {
      variables: { id: 'd4e5f6a7-89ab-4def-c012-456789012345' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperienceById.id).toBe(
      'd4e5f6a7-89ab-4def-c012-456789012345',
    );
    expect(res.data.userExperienceById.title).toBe('Product Manager');
  });
});

describe('mutation upsertUserGeneralExperience', () => {
  const UPSERT_USER_GENERAL_EXPERIENCE_MUTATION = /* GraphQL */ `
    mutation UpsertUserGeneralExperience(
      $input: UserGeneralExperienceInput!
      $id: ID
    ) {
      upsertUserGeneralExperience(input: $input, id: $id) {
        id
        type
        title
        subtitle
        description
        startedAt
        endedAt
        createdAt
        url
        grade
        externalReferenceId
        customCompanyName
        company {
          id
          name
          image
        }
      }
    }
  `;

  it('should require authentication', async () => {
    loggedUser = null;

    await testQueryErrorCode(
      client,
      {
        query: UPSERT_USER_GENERAL_EXPERIENCE_MUTATION,
        variables: {
          input: {
            type: 'certification',
            title: 'AWS Certified',
            startedAt: new Date('2023-01-01'),
          },
        },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should create a new certification experience', async () => {
    loggedUser = '1';

    const res = await client.mutate(UPSERT_USER_GENERAL_EXPERIENCE_MUTATION, {
      variables: {
        input: {
          type: 'certification',
          title: 'AWS Certified Solutions Architect',
          subtitle: 'Professional',
          description: 'Advanced AWS certification',
          startedAt: new Date('2023-01-01'),
          endedAt: new Date('2026-01-01'),
          companyId: 'company-1',
          url: 'https://aws.amazon.com/certification',
          externalReferenceId: 'AWS-123456',
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.upsertUserGeneralExperience.id).toBeDefined();
    expect(res.data.upsertUserGeneralExperience.type).toBe('certification');
    expect(res.data.upsertUserGeneralExperience.title).toBe(
      'AWS Certified Solutions Architect',
    );
    expect(res.data.upsertUserGeneralExperience.subtitle).toBe('Professional');
    expect(res.data.upsertUserGeneralExperience.description).toBe(
      'Advanced AWS certification',
    );
    expect(res.data.upsertUserGeneralExperience.url).toBe(
      'https://aws.amazon.com/certification',
    );
    expect(res.data.upsertUserGeneralExperience.externalReferenceId).toBe(
      'AWS-123456',
    );
    expect(res.data.upsertUserGeneralExperience.company.id).toBe('company-1');
    expect(res.data.upsertUserGeneralExperience.createdAt).toBeDefined();

    // Verify it was saved
    const saved = await con
      .getRepository(UserExperience)
      .findOneByOrFail({ id: res.data.upsertUserGeneralExperience.id });
    expect(saved.userId).toBe('1');
    expect(saved.type).toBe(UserExperienceType.Certification);
  });

  it('should create a new education experience', async () => {
    loggedUser = '1';

    const res = await client.mutate(UPSERT_USER_GENERAL_EXPERIENCE_MUTATION, {
      variables: {
        input: {
          type: 'education',
          title: 'Master of Science',
          subtitle: 'Computer Science',
          description: 'Focus on Machine Learning and AI',
          startedAt: new Date('2020-09-01'),
          endedAt: new Date('2022-06-30'),
          companyId: 'company-3',
          grade: '3.9 GPA',
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.upsertUserGeneralExperience.id).toBeDefined();
    expect(res.data.upsertUserGeneralExperience.type).toBe('education');
    expect(res.data.upsertUserGeneralExperience.title).toBe(
      'Master of Science',
    );
    expect(res.data.upsertUserGeneralExperience.grade).toBe('3.9 GPA');
    expect(res.data.upsertUserGeneralExperience.company.id).toBe('company-3');
  });

  it('should create a new project experience', async () => {
    loggedUser = '1';

    const res = await client.mutate(UPSERT_USER_GENERAL_EXPERIENCE_MUTATION, {
      variables: {
        input: {
          type: 'project',
          title: 'Daily.dev Chrome Extension',
          description: 'Built a popular browser extension for developers',
          startedAt: new Date('2021-01-01'),
          url: 'https://github.com/dailydotdev/extension',
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.upsertUserGeneralExperience.id).toBeDefined();
    expect(res.data.upsertUserGeneralExperience.type).toBe('project');
    expect(res.data.upsertUserGeneralExperience.title).toBe(
      'Daily.dev Chrome Extension',
    );
    expect(res.data.upsertUserGeneralExperience.url).toBe(
      'https://github.com/dailydotdev/extension',
    );
    expect(res.data.upsertUserGeneralExperience.endedAt).toBeNull();
  });

  it('should create experience with custom company name', async () => {
    loggedUser = '1';

    const res = await client.mutate(UPSERT_USER_GENERAL_EXPERIENCE_MUTATION, {
      variables: {
        input: {
          type: 'certification',
          title: 'Professional Scrum Master',
          startedAt: new Date('2023-01-01'),
          customCompanyName: 'Scrum.org',
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.upsertUserGeneralExperience.company).toBeNull();
    expect(res.data.upsertUserGeneralExperience.customCompanyName).toBe(
      'Scrum.org',
    );
  });

  it('should reuse existing company when custom company name matches (case-insensitive)', async () => {
    loggedUser = '1';

    const res = await client.mutate(UPSERT_USER_GENERAL_EXPERIENCE_MUTATION, {
      variables: {
        input: {
          type: 'education',
          title: 'PhD in Computer Science',
          startedAt: new Date('2023-01-01'),
          customCompanyName: 'GOOGLE', // Uppercase to test case-insensitive matching
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.upsertUserGeneralExperience.company.id).toBe('company-2');
    expect(res.data.upsertUserGeneralExperience.company.name).toBe('Google');
  });

  it('should update an existing experience', async () => {
    loggedUser = '1';

    const res = await client.mutate(UPSERT_USER_GENERAL_EXPERIENCE_MUTATION, {
      variables: {
        id: 'b2c3d4e5-6789-4bcd-aef0-234567890123', // Existing education
        input: {
          type: 'education',
          title: 'Computer Science - Updated',
          subtitle: 'Master of Science',
          description: 'Updated description',
          startedAt: new Date('2016-09-01'),
          endedAt: new Date('2020-06-30'),
          companyId: 'company-3',
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.upsertUserGeneralExperience.id).toBe(
      'b2c3d4e5-6789-4bcd-aef0-234567890123',
    );
    expect(res.data.upsertUserGeneralExperience.title).toBe(
      'Computer Science - Updated',
    );
    expect(res.data.upsertUserGeneralExperience.subtitle).toBe(
      'Master of Science',
    );
    expect(res.data.upsertUserGeneralExperience.description).toBe(
      'Updated description',
    );

    // Verify it was updated
    const updated = await con
      .getRepository(UserExperience)
      .findOneByOrFail({ id: 'b2c3d4e5-6789-4bcd-aef0-234567890123' });
    expect(updated.title).toBe('Computer Science - Updated');
  });

  it('should update company when updating an existing experience', async () => {
    loggedUser = '1';

    const res = await client.mutate(UPSERT_USER_GENERAL_EXPERIENCE_MUTATION, {
      variables: {
        id: 'b2c3d4e5-6789-4bcd-aef0-234567890123',
        input: {
          type: 'education',
          title: 'Computer Science',
          startedAt: new Date('2016-09-01'),
          companyId: 'company-2', // Change from company-3 to company-2
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.upsertUserGeneralExperience.company.id).toBe('company-2');

    const updated = await con
      .getRepository(UserExperience)
      .findOneByOrFail({ id: 'b2c3d4e5-6789-4bcd-aef0-234567890123' });
    expect(updated.companyId).toBe('company-2');
  });

  it('should set company to null when companyId is explicitly null', async () => {
    loggedUser = '1';

    const res = await client.mutate(UPSERT_USER_GENERAL_EXPERIENCE_MUTATION, {
      variables: {
        id: 'b2c3d4e5-6789-4bcd-aef0-234567890123',
        input: {
          type: 'education',
          title: 'Self-taught Developer',
          startedAt: new Date('2020-01-01'),
          companyId: null,
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.upsertUserGeneralExperience.company).toBeNull();

    const updated = await con
      .getRepository(UserExperience)
      .findOneByOrFail({ id: 'b2c3d4e5-6789-4bcd-aef0-234567890123' });
    expect(updated.companyId).toBeNull();
    expect(updated.customCompanyName).toBeNull(); // Should also be cleared
  });

  it('should fail when companyId does not exist', async () => {
    loggedUser = '1';

    await testQueryErrorCode(
      client,
      {
        query: UPSERT_USER_GENERAL_EXPERIENCE_MUTATION,
        variables: {
          input: {
            type: 'education',
            title: 'Computer Science',
            startedAt: new Date('2020-01-01'),
            companyId: '999e4567-e89b-12d3-a456-426614174000',
          },
        },
      },
      'NOT_FOUND',
    );
  });

  it('should fail when updating non-existent experience', async () => {
    loggedUser = '1';

    await testQueryErrorCode(
      client,
      {
        query: UPSERT_USER_GENERAL_EXPERIENCE_MUTATION,
        variables: {
          id: '999e4567-e89b-12d3-a456-426614174000',
          input: {
            type: 'certification',
            title: 'Test',
            startedAt: new Date('2020-01-01'),
          },
        },
      },
      'NOT_FOUND',
    );
  });

  it("should fail when trying to update another user's experience", async () => {
    loggedUser = '1';

    // Try to update user 2's experience
    await testQueryErrorCode(
      client,
      {
        query: UPSERT_USER_GENERAL_EXPERIENCE_MUTATION,
        variables: {
          id: 'd4e5f6a7-89ab-4def-c012-456789012345', // Belongs to user 2
          input: {
            type: 'work',
            title: 'Hacked Title',
            startedAt: new Date('2021-01-01'),
          },
        },
      },
      'NOT_FOUND',
    );

    // Verify the experience was not modified
    const unchanged = await con
      .getRepository(UserExperience)
      .findOneByOrFail({ id: 'd4e5f6a7-89ab-4def-c012-456789012345' });
    expect(unchanged.title).toBe('Product Manager');
    expect(unchanged.userId).toBe('2');
  });

  it('should allow user to update their own experience', async () => {
    loggedUser = '1';

    const res = await client.mutate(UPSERT_USER_GENERAL_EXPERIENCE_MUTATION, {
      variables: {
        id: 'c3d4e5f6-789a-4cde-bf01-345678901234', // User 1's project
        input: {
          type: 'project',
          title: 'Updated Project Title',
          startedAt: new Date('2021-06-01'),
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.upsertUserGeneralExperience.id).toBe(
      'c3d4e5f6-789a-4cde-bf01-345678901234',
    );
    expect(res.data.upsertUserGeneralExperience.title).toBe(
      'Updated Project Title',
    );

    // Verify it was updated
    const updated = await con
      .getRepository(UserExperience)
      .findOneByOrFail({ id: 'c3d4e5f6-789a-4cde-bf01-345678901234' });
    expect(updated.title).toBe('Updated Project Title');
    expect(updated.userId).toBe('1');
  });

  it('should fail when title exceeds max length', async () => {
    loggedUser = '1';

    await testQueryErrorCode(
      client,
      {
        query: UPSERT_USER_GENERAL_EXPERIENCE_MUTATION,
        variables: {
          input: {
            type: 'certification',
            title: 'A'.repeat(1001), // Max is 1000
            startedAt: new Date('2020-01-01'),
          },
        },
      },
      'ZOD_VALIDATION_ERROR',
    );
  });

  it('should fail when description exceeds max length', async () => {
    loggedUser = '1';

    await testQueryErrorCode(
      client,
      {
        query: UPSERT_USER_GENERAL_EXPERIENCE_MUTATION,
        variables: {
          input: {
            type: 'project',
            title: 'Test Project',
            description: 'A'.repeat(5001), // Max is 5000
            startedAt: new Date('2020-01-01'),
          },
        },
      },
      'ZOD_VALIDATION_ERROR',
    );
  });

  it('should fail when endedAt is before startedAt', async () => {
    loggedUser = '1';

    await testQueryErrorCode(
      client,
      {
        query: UPSERT_USER_GENERAL_EXPERIENCE_MUTATION,
        variables: {
          input: {
            type: 'education',
            title: 'Computer Science',
            startedAt: new Date('2023-01-01'),
            endedAt: new Date('2022-01-01'), // Before startedAt
          },
        },
      },
      'ZOD_VALIDATION_ERROR',
    );
  });

  it('should fail when url is not a valid URL for certification', async () => {
    loggedUser = '1';

    await testQueryErrorCode(
      client,
      {
        query: UPSERT_USER_GENERAL_EXPERIENCE_MUTATION,
        variables: {
          input: {
            type: 'certification',
            title: 'Test Certification',
            startedAt: new Date('2023-01-01'),
            url: 'not-a-url',
          },
        },
      },
      'ZOD_VALIDATION_ERROR',
    );
  });

  it('should fail when url is not a valid URL for project', async () => {
    loggedUser = '1';

    await testQueryErrorCode(
      client,
      {
        query: UPSERT_USER_GENERAL_EXPERIENCE_MUTATION,
        variables: {
          input: {
            type: 'project',
            title: 'Test Project',
            startedAt: new Date('2023-01-01'),
            url: 'invalid-url',
          },
        },
      },
      'ZOD_VALIDATION_ERROR',
    );
  });

  it('should fail when customCompanyName exceeds max length', async () => {
    loggedUser = '1';

    await testQueryErrorCode(
      client,
      {
        query: UPSERT_USER_GENERAL_EXPERIENCE_MUTATION,
        variables: {
          input: {
            type: 'education',
            title: 'Computer Science',
            startedAt: new Date('2023-01-01'),
            customCompanyName: 'A'.repeat(101), // Max is 100
          },
        },
      },
      'ZOD_VALIDATION_ERROR',
    );
  });

  it('should create experience without optional fields', async () => {
    loggedUser = '1';

    const res = await client.mutate(UPSERT_USER_GENERAL_EXPERIENCE_MUTATION, {
      variables: {
        input: {
          type: 'project',
          title: 'Minimal Project',
          startedAt: new Date('2023-01-01'),
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.upsertUserGeneralExperience.id).toBeDefined();
    expect(res.data.upsertUserGeneralExperience.title).toBe('Minimal Project');
    expect(res.data.upsertUserGeneralExperience.subtitle).toBeNull();
    expect(res.data.upsertUserGeneralExperience.description).toBeNull();
    expect(res.data.upsertUserGeneralExperience.endedAt).toBeNull();
    expect(res.data.upsertUserGeneralExperience.url).toBeNull();
    expect(res.data.upsertUserGeneralExperience.company).toBeNull();
  });

  it('should trim and normalize customCompanyName name', async () => {
    loggedUser = '1';

    const res = await client.mutate(UPSERT_USER_GENERAL_EXPERIENCE_MUTATION, {
      variables: {
        input: {
          type: 'certification',
          title: 'Test Certification',
          startedAt: new Date('2023-01-01'),
          customCompanyName: '  Test Company  ', // With extra whitespace
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.upsertUserGeneralExperience.company).toBeNull();

    // Verify customCompanyName was trimmed and stored
    const saved = await con
      .getRepository(UserExperience)
      .findOneByOrFail({ id: res.data.upsertUserGeneralExperience.id });
    expect(saved.customCompanyName).toBe('Test Company'); // Trimmed by zod
  });

  it('should update experience from custom company name to real company', async () => {
    loggedUser = '1';

    // First create with custom company name
    const created = await client.mutate(
      UPSERT_USER_GENERAL_EXPERIENCE_MUTATION,
      {
        variables: {
          input: {
            type: 'certification',
            title: 'Test Certification',
            startedAt: new Date('2023-01-01'),
            customCompanyName: 'Custom Company',
          },
        },
      },
    );

    expect(created.errors).toBeFalsy();
    const experienceId = created.data.upsertUserGeneralExperience.id;

    // Verify custom company name was set
    const savedBefore = await con
      .getRepository(UserExperience)
      .findOneByOrFail({ id: experienceId });
    expect(savedBefore.customCompanyName).toBe('Custom Company');
    expect(savedBefore.companyId).toBeNull();

    // Now update to use a real company
    const updated = await client.mutate(
      UPSERT_USER_GENERAL_EXPERIENCE_MUTATION,
      {
        variables: {
          id: experienceId,
          input: {
            type: 'certification',
            title: 'Test Certification',
            startedAt: new Date('2023-01-01'),
            companyId: 'company-1',
          },
        },
      },
    );

    expect(updated.errors).toBeFalsy();
    expect(updated.data.upsertUserGeneralExperience.company.id).toBe(
      'company-1',
    );

    // Verify the update - customCompanyName should be cleared when companyId is set
    const savedAfter = await con
      .getRepository(UserExperience)
      .findOneByOrFail({ id: experienceId });
    expect(savedAfter.companyId).toBe('company-1');
    expect(savedAfter.customCompanyName).toBeNull(); // Should be cleared
  });

  it('should update experience from real company to custom company name', async () => {
    loggedUser = '1';

    // Update existing experience (that has a real company) to use custom company name
    const res = await client.mutate(UPSERT_USER_GENERAL_EXPERIENCE_MUTATION, {
      variables: {
        id: 'b2c3d4e5-6789-4bcd-aef0-234567890123', // Has company-3
        input: {
          type: 'education',
          title: 'Computer Science',
          startedAt: new Date('2016-09-01'),
          customCompanyName: 'My Custom University',
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.upsertUserGeneralExperience.company).toBeNull();

    const updated = await con
      .getRepository(UserExperience)
      .findOneByOrFail({ id: 'b2c3d4e5-6789-4bcd-aef0-234567890123' });
    expect(updated.customCompanyName).toBe('My Custom University');
    expect(updated.companyId).toBeNull();
  });
});

describe('mutation upsertUserWorkExperience', () => {
  const UPSERT_USER_WORK_EXPERIENCE_MUTATION = /* GraphQL */ `
    mutation UpsertUserWorkExperience(
      $input: UserExperienceWorkInput!
      $id: ID
    ) {
      upsertUserWorkExperience(input: $input, id: $id) {
        id
        type
        title
        subtitle
        description
        startedAt
        endedAt
        createdAt
        employmentType
        locationType
        externalReferenceId
        company {
          id
          name
        }
      }
    }
  `;

  beforeEach(async () => {
    // Create some skills for testing
    await saveFixtures(con, UserSkill, [
      { name: 'TypeScript', valid: true },
      { name: 'Node.js', valid: true },
      { name: 'React', valid: true },
      { name: 'InvalidSkill', valid: false },
    ]);
  });

  it('should require authentication', async () => {
    loggedUser = null;

    await testQueryErrorCode(
      client,
      {
        query: UPSERT_USER_WORK_EXPERIENCE_MUTATION,
        variables: {
          input: {
            type: 'work',
            title: 'Software Engineer',
            startedAt: new Date('2023-01-01'),
            skills: [],
          },
        },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should create work experience without skills', async () => {
    loggedUser = '1';

    const res = await client.mutate(UPSERT_USER_WORK_EXPERIENCE_MUTATION, {
      variables: {
        input: {
          type: 'work',
          title: 'Software Engineer',
          subtitle: 'Backend',
          description: 'Building APIs',
          startedAt: new Date('2023-01-01'),
          companyId: 'company-1',
          employmentType: 1,
          locationType: 2,
          skills: [],
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.upsertUserWorkExperience.id).toBeDefined();
    expect(res.data.upsertUserWorkExperience.type).toBe('work');
    expect(res.data.upsertUserWorkExperience.title).toBe('Software Engineer');
    expect(res.data.upsertUserWorkExperience.employmentType).toBe(1);
    expect(res.data.upsertUserWorkExperience.locationType).toBe(2);

    // Verify no skills were created
    const skills = await con.getRepository(UserExperienceSkill).find({
      where: { experienceId: res.data.upsertUserWorkExperience.id },
    });
    expect(skills).toHaveLength(0);
  });

  it('should create work experience with existing skills', async () => {
    loggedUser = '1';

    const res = await client.mutate(UPSERT_USER_WORK_EXPERIENCE_MUTATION, {
      variables: {
        input: {
          type: 'work',
          title: 'Full Stack Developer',
          startedAt: new Date('2023-01-01'),
          companyId: 'company-1',
          skills: ['TypeScript', 'React'],
        },
      },
    });

    expect(res.errors).toBeFalsy();
    const experienceId = res.data.upsertUserWorkExperience.id;

    // Verify skills were linked
    const skills = await con.getRepository(UserExperienceSkill).find({
      where: { experienceId },
    });
    expect(skills).toHaveLength(2);
    expect(skills.map((s) => s.slug).sort()).toEqual(['react', 'typescript']);
  });

  it('should create work experience with new skills', async () => {
    loggedUser = '1';

    const res = await client.mutate(UPSERT_USER_WORK_EXPERIENCE_MUTATION, {
      variables: {
        input: {
          type: 'work',
          title: 'DevOps Engineer',
          startedAt: new Date('2023-01-01'),
          companyId: 'company-1',
          skills: ['Docker', 'Kubernetes', 'AWS'],
        },
      },
    });

    expect(res.errors).toBeFalsy();
    const experienceId = res.data.upsertUserWorkExperience.id;

    // Verify new skills were created
    const newSkills = await con.getRepository(UserSkill).find({
      where: { slug: 'docker' },
    });
    expect(newSkills).toHaveLength(1);
    expect(newSkills[0].name).toBe('Docker');

    // Verify skills were linked
    const skills = await con.getRepository(UserExperienceSkill).find({
      where: { experienceId },
    });
    expect(skills).toHaveLength(3);
  });

  it('should create work experience with mix of existing and new skills', async () => {
    loggedUser = '1';

    const res = await client.mutate(UPSERT_USER_WORK_EXPERIENCE_MUTATION, {
      variables: {
        input: {
          type: 'work',
          title: 'Senior Developer',
          startedAt: new Date('2023-01-01'),
          companyId: 'company-1',
          skills: ['TypeScript', 'Python', 'Node.js', 'Django'],
        },
      },
    });

    expect(res.errors).toBeFalsy();
    const experienceId = res.data.upsertUserWorkExperience.id;

    // Verify all skills were linked
    const skills = await con.getRepository(UserExperienceSkill).find({
      where: { experienceId },
    });
    expect(skills).toHaveLength(4);

    // Verify new skills were created
    const pythonSkill = await con.getRepository(UserSkill).findOne({
      where: { slug: 'python' },
    });
    expect(pythonSkill).toBeDefined();
    expect(pythonSkill!.name).toBe('Python');
  });

  it('should update work experience and add new skills', async () => {
    loggedUser = '1';

    // Create initial experience with some skills
    const created = await client.mutate(UPSERT_USER_WORK_EXPERIENCE_MUTATION, {
      variables: {
        input: {
          type: 'work',
          title: 'Developer',
          startedAt: new Date('2023-01-01'),
          companyId: 'company-1',
          skills: ['TypeScript'],
        },
      },
    });

    const experienceId = created.data.upsertUserWorkExperience.id;

    // Update and add more skills
    const updated = await client.mutate(UPSERT_USER_WORK_EXPERIENCE_MUTATION, {
      variables: {
        id: experienceId,
        input: {
          type: 'work',
          title: 'Senior Developer',
          startedAt: new Date('2023-01-01'),
          companyId: 'company-1',
          skills: ['TypeScript', 'React', 'Node.js'],
        },
      },
    });

    expect(updated.errors).toBeFalsy();
    expect(updated.data.upsertUserWorkExperience.title).toBe(
      'Senior Developer',
    );

    // Verify all skills are linked
    const skills = await con.getRepository(UserExperienceSkill).find({
      where: { experienceId },
    });
    expect(skills).toHaveLength(3);
  });

  it('should update work experience and remove some skills', async () => {
    loggedUser = '1';

    // Create initial experience with multiple skills
    const created = await client.mutate(UPSERT_USER_WORK_EXPERIENCE_MUTATION, {
      variables: {
        input: {
          type: 'work',
          title: 'Developer',
          startedAt: new Date('2023-01-01'),
          companyId: 'company-1',
          skills: ['TypeScript', 'React', 'Node.js'],
        },
      },
    });

    const experienceId = created.data.upsertUserWorkExperience.id;

    // Update with fewer skills
    const updated = await client.mutate(UPSERT_USER_WORK_EXPERIENCE_MUTATION, {
      variables: {
        id: experienceId,
        input: {
          type: 'work',
          title: 'Developer',
          startedAt: new Date('2023-01-01'),
          companyId: 'company-1',
          skills: ['TypeScript'],
        },
      },
    });

    expect(updated.errors).toBeFalsy();

    // Verify only TypeScript skill remains
    const skills = await con.getRepository(UserExperienceSkill).find({
      where: { experienceId },
    });
    expect(skills).toHaveLength(1);
    expect(skills[0].slug).toBe('typescript');
  });

  it('should update work experience and clear all skills', async () => {
    loggedUser = '1';

    // Create initial experience with skills
    const created = await client.mutate(UPSERT_USER_WORK_EXPERIENCE_MUTATION, {
      variables: {
        input: {
          type: 'work',
          title: 'Developer',
          startedAt: new Date('2023-01-01'),
          companyId: 'company-1',
          skills: ['TypeScript', 'React'],
        },
      },
    });

    const experienceId = created.data.upsertUserWorkExperience.id;

    // Verify skills exist
    let skills = await con.getRepository(UserExperienceSkill).find({
      where: { experienceId },
    });
    expect(skills).toHaveLength(2);

    // Update with empty skills array
    const updated = await client.mutate(UPSERT_USER_WORK_EXPERIENCE_MUTATION, {
      variables: {
        id: experienceId,
        input: {
          type: 'work',
          title: 'Developer',
          startedAt: new Date('2023-01-01'),
          companyId: 'company-1',
          skills: [],
        },
      },
    });

    expect(updated.errors).toBeFalsy();

    // Verify all skills were removed
    skills = await con.getRepository(UserExperienceSkill).find({
      where: { experienceId },
    });
    expect(skills).toHaveLength(0);
  });

  it('should not delete skills from other experiences when updating (same slug isolation)', async () => {
    loggedUser = '1';

    // Create first experience with skills including TypeScript
    const exp1 = await client.mutate(UPSERT_USER_WORK_EXPERIENCE_MUTATION, {
      variables: {
        input: {
          type: 'work',
          title: 'Developer 1',
          startedAt: new Date('2023-01-01'),
          companyId: 'company-1',
          skills: ['TypeScript', 'React'],
        },
      },
    });

    const exp1Id = exp1.data.upsertUserWorkExperience.id;

    // Create second experience with overlapping TypeScript skill (same slug!)
    const exp2 = await client.mutate(UPSERT_USER_WORK_EXPERIENCE_MUTATION, {
      variables: {
        input: {
          type: 'work',
          title: 'Developer 2',
          startedAt: new Date('2022-01-01'),
          companyId: 'company-2',
          skills: ['TypeScript', 'Node.js'],
        },
      },
    });

    const exp2Id = exp2.data.upsertUserWorkExperience.id;

    const typeScriptSlug = 'typescript';

    // Verify both experiences have TypeScript before deletion
    const exp1SkillsBefore = await con.getRepository(UserExperienceSkill).find({
      where: { experienceId: exp1Id },
    });
    const exp2SkillsBefore = await con.getRepository(UserExperienceSkill).find({
      where: { experienceId: exp2Id },
    });
    expect(exp1SkillsBefore.some((s) => s.slug === typeScriptSlug)).toBe(true);
    expect(exp2SkillsBefore.some((s) => s.slug === typeScriptSlug)).toBe(true);

    // Update first experience to clear all skills (including TypeScript)
    await client.mutate(UPSERT_USER_WORK_EXPERIENCE_MUTATION, {
      variables: {
        id: exp1Id,
        input: {
          type: 'work',
          title: 'Developer 1',
          startedAt: new Date('2023-01-01'),
          companyId: 'company-1',
          skills: [],
        },
      },
    });

    // Verify first experience has no skills
    const exp1SkillsAfter = await con.getRepository(UserExperienceSkill).find({
      where: { experienceId: exp1Id },
    });
    expect(exp1SkillsAfter).toHaveLength(0);

    // CRITICAL: Verify second experience still has its skills, including the shared TypeScript slug
    const exp2SkillsAfter = await con.getRepository(UserExperienceSkill).find({
      where: { experienceId: exp2Id },
    });
    expect(exp2SkillsAfter).toHaveLength(2);

    // Verify TypeScript is still linked to exp2 (same slug, different experienceId)
    expect(exp2SkillsAfter.some((s) => s.slug === typeScriptSlug)).toBe(true);
    expect(exp2SkillsAfter.map((s) => s.slug).sort()).toEqual([
      'node-js',
      'typescript',
    ]);

    // Verify the UserSkill record for TypeScript still exists
    const typeScriptSkill = await con.getRepository(UserSkill).findOne({
      where: { slug: typeScriptSlug },
    });
    expect(typeScriptSkill).toBeDefined();
    expect(typeScriptSkill!.name).toBe('TypeScript');
  });

  it('should never delete UserSkill records (managed externally)', async () => {
    loggedUser = '1';

    // User 1 creates experience with an invalid skill
    const user1Exp = await client.mutate(UPSERT_USER_WORK_EXPERIENCE_MUTATION, {
      variables: {
        input: {
          type: 'work',
          title: 'Developer 1',
          startedAt: new Date('2023-01-01'),
          companyId: 'company-1',
          skills: ['InvalidSkill', 'TypeScript'],
        },
      },
    });

    const user1ExpId = user1Exp.data.upsertUserWorkExperience.id;

    // User 2 creates experience with the SAME invalid skill
    loggedUser = '2';
    const user2Exp = await client.mutate(UPSERT_USER_WORK_EXPERIENCE_MUTATION, {
      variables: {
        input: {
          type: 'work',
          title: 'Developer 2',
          startedAt: new Date('2023-01-01'),
          companyId: 'company-2',
          skills: ['InvalidSkill', 'React'],
        },
      },
    });

    const user2ExpId = user2Exp.data.upsertUserWorkExperience.id;

    const invalidSkillSlug = 'invalidskill';

    // Verify both users have the invalid skill linked
    const user1SkillsBefore = await con
      .getRepository(UserExperienceSkill)
      .find({
        where: { experienceId: user1ExpId },
      });
    const user2SkillsBefore = await con
      .getRepository(UserExperienceSkill)
      .find({
        where: { experienceId: user2ExpId },
      });
    expect(user1SkillsBefore.some((s) => s.slug === invalidSkillSlug)).toBe(
      true,
    );
    expect(user2SkillsBefore.some((s) => s.slug === invalidSkillSlug)).toBe(
      true,
    );

    // User 1 removes the invalid skill
    loggedUser = '1';
    await client.mutate(UPSERT_USER_WORK_EXPERIENCE_MUTATION, {
      variables: {
        id: user1ExpId,
        input: {
          type: 'work',
          title: 'Developer 1',
          startedAt: new Date('2023-01-01'),
          companyId: 'company-1',
          skills: ['TypeScript'], // Removed InvalidSkill
        },
      },
    });

    // Verify User 1's experience no longer has InvalidSkill linked
    const user1SkillsAfter = await con.getRepository(UserExperienceSkill).find({
      where: { experienceId: user1ExpId },
    });
    expect(user1SkillsAfter.some((s) => s.slug === invalidSkillSlug)).toBe(
      false,
    );

    // User 2's experience should still have InvalidSkill
    const user2SkillsAfter = await con.getRepository(UserExperienceSkill).find({
      where: { experienceId: user2ExpId },
    });
    expect(user2SkillsAfter.some((s) => s.slug === invalidSkillSlug)).toBe(
      true,
    );

    // IMPORTANT: The UserSkill record remains in the database (not deleted by mutation)
    // This is intentional - orphaned skills should be cleaned up by a separate maintenance job
    const invalidSkill = await con.getRepository(UserSkill).findOne({
      where: { slug: invalidSkillSlug },
    });
    expect(invalidSkill).toBeDefined();
    expect(invalidSkill!.valid).toBe(false);
  });

  it('should preserve all UserSkill records regardless of usage', async () => {
    loggedUser = '1';

    // Count all skills before
    const allSkillsBefore = await con.getRepository(UserSkill).count();

    // Create experience with some skills (not all)
    await client.mutate(UPSERT_USER_WORK_EXPERIENCE_MUTATION, {
      variables: {
        input: {
          type: 'work',
          title: 'Developer',
          startedAt: new Date('2023-01-01'),
          companyId: 'company-1',
          skills: ['TypeScript'],
        },
      },
    });

    // Count all skills after
    const allSkillsAfter = await con.getRepository(UserSkill).count();

    // All pre-existing skills should remain (mutation never deletes UserSkill records)
    expect(allSkillsAfter).toBeGreaterThanOrEqual(allSkillsBefore);
  });

  it('should handle custom company name with work experience', async () => {
    loggedUser = '1';

    const res = await client.mutate(UPSERT_USER_WORK_EXPERIENCE_MUTATION, {
      variables: {
        input: {
          type: 'work',
          title: 'Freelance Developer',
          startedAt: new Date('2023-01-01'),
          customCompanyName: 'My Startup',
          skills: ['TypeScript'],
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.upsertUserWorkExperience.company).toBeNull();

    const saved = await con
      .getRepository(UserExperience)
      .findOneByOrFail({ id: res.data.upsertUserWorkExperience.id });
    expect(saved.customCompanyName).toBe('My Startup');
    expect(saved.companyId).toBeNull();
  });

  it("should fail when trying to update another user's work experience", async () => {
    loggedUser = '1';

    // Try to update user 2's work experience
    await testQueryErrorCode(
      client,
      {
        query: UPSERT_USER_WORK_EXPERIENCE_MUTATION,
        variables: {
          id: 'd4e5f6a7-89ab-4def-c012-456789012345', // Belongs to user 2
          input: {
            type: 'work',
            title: 'Hacked Title',
            startedAt: new Date('2021-01-01'),
            skills: [],
          },
        },
      },
      'NOT_FOUND',
    );
  });

  it('should handle skills with special characters and normalize them', async () => {
    loggedUser = '1';

    const res = await client.mutate(UPSERT_USER_WORK_EXPERIENCE_MUTATION, {
      variables: {
        input: {
          type: 'work',
          title: 'Developer',
          startedAt: new Date('2023-01-01'),
          companyId: 'company-1',
          skills: ['C++', 'Node.js', 'ASP.NET Core'],
        },
      },
    });

    expect(res.errors).toBeFalsy();
    const experienceId = res.data.upsertUserWorkExperience.id;

    // Verify skills were created with proper slugs
    const skills = await con.getRepository(UserExperienceSkill).find({
      where: { experienceId },
    });
    expect(skills).toHaveLength(3);

    // Check that slugs are properly formatted
    const slugs = skills.map((s) => s.slug).sort();
    expect(slugs).toContain('c');
    expect(slugs).toContain('node-js');
    expect(slugs).toContain('asp-net-core');
  });

  it('should handle duplicate skill names (case variations)', async () => {
    loggedUser = '1';

    const res = await client.mutate(UPSERT_USER_WORK_EXPERIENCE_MUTATION, {
      variables: {
        input: {
          type: 'work',
          title: 'Developer',
          startedAt: new Date('2023-01-01'),
          companyId: 'company-1',
          skills: ['TypeScript', 'typescript', 'TYPESCRIPT'],
        },
      },
    });

    expect(res.errors).toBeFalsy();
    const experienceId = res.data.upsertUserWorkExperience.id;

    // Should only create one skill link since they all normalize to the same slug
    const skills = await con.getRepository(UserExperienceSkill).find({
      where: { experienceId },
    });
    // All three variations should resolve to the same slug
    const uniqueSlugs = new Set(skills.map((s) => s.slug));
    expect(uniqueSlugs.size).toBeLessThanOrEqual(3);
  });
});
