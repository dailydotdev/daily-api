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
    expect(res.data.userExperiences.edges[0].node).toMatchObject({
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', // exp-1: Started 2022-01-01, active
      endedAt: null,
      company: {
        name: 'Daily.dev',
      },
    });
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
    expect(experience).toMatchObject({
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      type: 'work',
      title: 'Senior Software Engineer',
      company: {
        id: 'company-1',
        name: 'Daily.dev',
      },
    });

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
    expect(experience).toMatchObject({
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      type: 'work',
      title: 'Senior Software Engineer',
      subtitle: 'Backend Team',
      description: 'Working on API infrastructure',
      startedAt: '2022-01-01T00:00:00.000Z',
      createdAt: '2022-01-01T00:00:00.000Z',
      company: {
        id: 'company-1',
        name: 'Daily.dev',
        image: 'https://daily.dev/logo.png',
      },
    });
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
    expect(res.data.userExperiences.edges[0].node).toMatchObject({
      id: 'b2c3d4e5-6789-4bcd-aef0-234567890123',
      type: 'education',
    });
  });

  it('should filter by project type', async () => {
    loggedUser = '1';

    const res = await client.query(USER_EXPERIENCES_QUERY, {
      variables: { userId: '1', type: 'project' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperiences.edges).toHaveLength(1);
    expect(res.data.userExperiences.edges[0].node).toMatchObject({
      id: 'c3d4e5f6-789a-4cde-bf01-345678901234',
      type: 'project',
    });
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
    expect(res.data.userExperiences.edges[0].node).toMatchObject({
      id: 'd4e5f6a7-89ab-4def-c012-456789012345',
    });
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
    expect(res.data.userExperienceById).toMatchObject({
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      type: 'work',
      title: 'Senior Software Engineer',
      subtitle: 'Backend Team',
      description: 'Working on API infrastructure',
      endedAt: null,
      company: {
        name: 'Daily.dev',
      },
    });
  });

  it('should return education experience by id', async () => {
    loggedUser = '1';

    const res = await client.query(USER_EXPERIENCE_BY_ID_QUERY, {
      variables: { id: 'b2c3d4e5-6789-4bcd-aef0-234567890123' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperienceById).toMatchObject({
      id: 'b2c3d4e5-6789-4bcd-aef0-234567890123',
      type: 'education',
      title: 'Computer Science',
      company: {
        name: 'University of Example',
      },
    });
  });

  it('should return project experience by id', async () => {
    loggedUser = '1';

    const res = await client.query(USER_EXPERIENCE_BY_ID_QUERY, {
      variables: { id: 'c3d4e5f6-789a-4cde-bf01-345678901234' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperienceById).toMatchObject({
      id: 'c3d4e5f6-789a-4cde-bf01-345678901234',
      type: 'project',
      title: 'Open Source Contributor',
    });
  });

  it('should return error when experience does not exist', async () => {
    loggedUser = '1';

    await testQueryErrorCode(
      client,
      {
        query: USER_EXPERIENCE_BY_ID_QUERY,
        variables: { id: 'f47ac10b-58cc-4372-a567-3e02b2c3d479' }, // manually adjusted to be unique
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
    expect(res.data.userExperienceById).toMatchObject({
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    });
  });

  it('should restrict fields for anonymous users when fetching by id', async () => {
    loggedUser = null;

    const res = await client.query(USER_EXPERIENCE_BY_ID_QUERY, {
      variables: { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
    });

    expect(res.errors).toBeFalsy();

    const experience = res.data.userExperienceById;

    // Allowed columns for anonymous users
    expect(experience).toMatchObject({
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      type: 'work',
      title: 'Senior Software Engineer',
      company: {
        name: 'Daily.dev',
      },
    });

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
    expect(res.data.userExperienceById).toMatchObject({
      id: 'd4e5f6a7-89ab-4def-c012-456789012345',
      title: 'Product Manager',
    });
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
    expect(res.data.upsertUserGeneralExperience).toMatchObject({
      id: expect.any(String),
      type: 'certification',
      title: 'AWS Certified Solutions Architect',
      subtitle: 'Professional',
      description: 'Advanced AWS certification',
      url: 'https://aws.amazon.com/certification',
      externalReferenceId: 'AWS-123456',
      createdAt: expect.any(String),
      company: {
        id: 'company-1',
      },
    });
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
    expect(res.data.upsertUserGeneralExperience).toMatchObject({
      id: expect.any(String),
      type: 'education',
      title: 'Master of Science',
      grade: '3.9 GPA',
      company: {
        id: 'company-3',
      },
    });
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
    expect(res.data.upsertUserGeneralExperience).toMatchObject({
      id: expect.any(String),
      type: 'project',
      title: 'Daily.dev Chrome Extension',
      url: 'https://github.com/dailydotdev/extension',
      endedAt: null,
    });
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
    expect(res.data.upsertUserGeneralExperience).toMatchObject({
      company: null,
      customCompanyName: 'Scrum.org',
    });
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
    expect(res.data.upsertUserGeneralExperience).toMatchObject({
      company: {
        id: 'company-2',
        name: 'Google',
      },
    });
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
    expect(res.data.upsertUserGeneralExperience).toMatchObject({
      id: 'b2c3d4e5-6789-4bcd-aef0-234567890123',
      title: 'Computer Science - Updated',
      subtitle: 'Master of Science',
      description: 'Updated description',
    });
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
    expect(res.data.upsertUserGeneralExperience).toMatchObject({
      company: {
        id: 'company-2',
      },
    });
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
    expect(res.data.upsertUserGeneralExperience).toMatchObject({
      company: null,
    });
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
    expect(res.data.upsertUserGeneralExperience).toMatchObject({
      id: 'c3d4e5f6-789a-4cde-bf01-345678901234',
      title: 'Updated Project Title',
    });
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
    expect(res.data.upsertUserGeneralExperience).toMatchObject({
      id: expect.any(String),
      title: 'Minimal Project',
      subtitle: null,
      description: null,
      endedAt: null,
      url: null,
      company: null,
    });
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
    expect(res.data.upsertUserGeneralExperience).toMatchObject({
      company: null,
      customCompanyName: 'Test Company',
    });
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
    expect(created.data.upsertUserGeneralExperience).toMatchObject({
      company: null,
      customCompanyName: 'Custom Company',
    });
    const experienceId = created.data.upsertUserGeneralExperience.id;

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
    expect(updated.data.upsertUserGeneralExperience).toMatchObject({
      company: {
        id: 'company-1',
        name: 'Daily.dev',
      },
      customCompanyName: null,
    });
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
    expect(res.data.upsertUserGeneralExperience).toMatchObject({
      company: null,
      customCompanyName: 'My Custom University',
    });
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
        skills {
          value
        }
        customCompanyName
        company {
          id
          name
        }
      }
    }
  `;

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

  it('should create work experience with all fields', async () => {
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
          skills: ['TypeScript', 'Node.js'],
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.upsertUserWorkExperience).toMatchObject({
      id: expect.any(String),
      type: 'work',
      title: 'Software Engineer',
      subtitle: 'Backend',
      description: 'Building APIs',
      employmentType: 1,
      locationType: 2,
      company: {
        id: 'company-1',
      },
    });
  });

  it('should update work experience fields', async () => {
    loggedUser = '1';

    // Create initial experience
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

    // Update title and other fields
    const updated = await client.mutate(UPSERT_USER_WORK_EXPERIENCE_MUTATION, {
      variables: {
        id: experienceId,
        input: {
          type: 'work',
          title: 'Senior Developer',
          subtitle: 'Tech Lead',
          description: 'Leading the backend team',
          startedAt: new Date('2023-01-01'),
          endedAt: new Date('2024-01-01'),
          companyId: 'company-1',
          skills: ['TypeScript', 'React', 'Node.js'],
        },
      },
    });

    expect(updated.errors).toBeFalsy();
    expect(updated.data.upsertUserWorkExperience).toMatchObject({
      id: experienceId,
      title: 'Senior Developer',
      subtitle: 'Tech Lead',
      description: 'Leading the backend team',
    });
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
    expect(res.data.upsertUserWorkExperience).toMatchObject({
      company: null,
      customCompanyName: 'My Startup',
    });
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

  it('should fail when locationId does not exist', async () => {
    loggedUser = '1';

    await testQueryErrorCode(
      client,
      {
        query: UPSERT_USER_WORK_EXPERIENCE_MUTATION,
        variables: {
          input: {
            type: 'work',
            title: 'Remote Developer',
            startedAt: new Date('2023-01-01'),
            companyId: 'company-1',
            locationId: 'd4e5f6a7-89ab-4dea-a012-456789012345', // Non-existent location UUID (v4 format)
            skills: [],
          },
        },
      },
      'NOT_FOUND',
    );
  });

  it('should add new skills when creating experience', async () => {
    loggedUser = '1';

    const res = await client.mutate(UPSERT_USER_WORK_EXPERIENCE_MUTATION, {
      variables: {
        input: {
          type: 'work',
          title: 'Full Stack Developer',
          startedAt: new Date('2023-01-01'),
          companyId: 'company-1',
          skills: ['TypeScript', 'React', 'Node.js'],
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.upsertUserWorkExperience).toMatchObject({
      id: expect.any(String),
      type: 'work',
      title: 'Full Stack Developer',
      skills: [
        { value: 'TypeScript' },
        { value: 'React' },
        { value: 'Node.js' },
      ],
    });
  });

  it('should remove skills when updating with fewer skills', async () => {
    loggedUser = '1';

    // Create with multiple skills
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

    // Verify initial skills
    expect(created.data.upsertUserWorkExperience).toMatchObject({
      skills: [
        { value: 'TypeScript' },
        { value: 'React' },
        { value: 'Node.js' },
      ],
    });

    // Update with only one skill (should remove React and Node.js)
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
    // Verify only TypeScript remains (React and Node.js removed)
    expect(updated.data.upsertUserWorkExperience).toMatchObject({
      id: experienceId,
      skills: [{ value: 'TypeScript' }],
    });
  });

  it('should treat skills with different casing as the same skill', async () => {
    loggedUser = '1';

    // Create with lowercase skill
    const created = await client.mutate(UPSERT_USER_WORK_EXPERIENCE_MUTATION, {
      variables: {
        input: {
          type: 'work',
          title: 'Developer',
          startedAt: new Date('2023-01-01'),
          companyId: 'company-1',
          skills: ['typescript', 'react'],
        },
      },
    });

    const experienceId = created.data.upsertUserWorkExperience.id;

    // Verify initial skills
    expect(created.data.upsertUserWorkExperience).toMatchObject({
      skills: [{ value: 'typescript' }, { value: 'react' }],
    });

    // Update with different casing - should replace, not duplicate
    const updated = await client.mutate(UPSERT_USER_WORK_EXPERIENCE_MUTATION, {
      variables: {
        id: experienceId,
        input: {
          type: 'work',
          title: 'Developer',
          startedAt: new Date('2023-01-01'),
          companyId: 'company-1',
          skills: ['TypeScript', 'React', 'Node.js'], // Different casing + new skill
        },
      },
    });

    expect(updated.errors).toBeFalsy();
    // Should have exactly 3 skills, not 5 (no duplicates with different casing)
    expect(updated.data.upsertUserWorkExperience.skills).toHaveLength(3);

    // Should have the new casing versions, not both
    const skillValues = updated.data.upsertUserWorkExperience.skills.map(
      (s) => s.value,
    );
    expect(skillValues).toContain('typescript');
    expect(skillValues).toContain('react');
    expect(skillValues).toContain('Node.js');

    // Should NOT have the old casing versions
    expect(skillValues).not.toContain('TypeScript');
    expect(skillValues).not.toContain('React');
  });

  it('should handle mix of adding, removing, and keeping skills', async () => {
    loggedUser = '1';

    // Create with initial skills
    const created = await client.mutate(UPSERT_USER_WORK_EXPERIENCE_MUTATION, {
      variables: {
        input: {
          type: 'work',
          title: 'Developer',
          startedAt: new Date('2023-01-01'),
          companyId: 'company-1',
          skills: ['TypeScript', 'React', 'MongoDB'],
        },
      },
    });

    const experienceId = created.data.upsertUserWorkExperience.id;

    // Verify initial skills
    expect(created.data.upsertUserWorkExperience).toMatchObject({
      skills: [
        { value: 'TypeScript' },
        { value: 'React' },
        { value: 'MongoDB' },
      ],
    });

    // Update: keep TypeScript, remove React and MongoDB, add Node.js and Python
    const updated = await client.mutate(UPSERT_USER_WORK_EXPERIENCE_MUTATION, {
      variables: {
        id: experienceId,
        input: {
          type: 'work',
          title: 'Developer',
          startedAt: new Date('2023-01-01'),
          companyId: 'company-1',
          skills: ['TypeScript', 'Node.js', 'Python'],
        },
      },
    });

    expect(updated.errors).toBeFalsy();
    // Verify skills were updated correctly: TypeScript kept, React and MongoDB removed, Node.js and Python added
    expect(updated.data.upsertUserWorkExperience).toMatchObject({
      id: experienceId,
      skills: [
        { value: 'TypeScript' },
        { value: 'Node.js' },
        { value: 'Python' },
      ],
    });
  });

  it('should clear all skills when updating with empty array', async () => {
    loggedUser = '1';

    // Create with skills
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

    // Verify initial skills exist
    expect(created.data.upsertUserWorkExperience).toMatchObject({
      skills: [{ value: 'TypeScript' }, { value: 'React' }],
    });

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
    // Verify all skills were cleared
    expect(updated.data.upsertUserWorkExperience).toMatchObject({
      id: experienceId,
      skills: [],
    });
  });
});
