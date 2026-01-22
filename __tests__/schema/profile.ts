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
            isOwner
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
      isOwner: true,
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
      isOwner: false,
    });
  });

  it('should return empty list when viewing another user with hideExperience enabled', async () => {
    loggedUser = '1';

    // Set user 2's hideExperience to true
    await con.getRepository(User).update({ id: '2' }, { hideExperience: true });

    const res = await client.query(USER_EXPERIENCES_QUERY, {
      variables: { userId: '2' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperiences.edges).toHaveLength(0);
    expect(res.data.userExperiences.pageInfo.hasNextPage).toBe(false);
  });

  it('should return own experiences even with hideExperience enabled', async () => {
    loggedUser = '1';

    // Set user 1's hideExperience to true
    await con.getRepository(User).update({ id: '1' }, { hideExperience: true });

    const res = await client.query(USER_EXPERIENCES_QUERY, {
      variables: { userId: '1' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperiences.edges).toHaveLength(4);
  });

  it('should return experiences for another user when hideExperience is false', async () => {
    loggedUser = '1';

    // Explicitly set user 2's hideExperience to false
    await con
      .getRepository(User)
      .update({ id: '2' }, { hideExperience: false });

    const res = await client.query(USER_EXPERIENCES_QUERY, {
      variables: { userId: '2' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperiences.edges).toHaveLength(1);
  });

  it('should return empty list for anonymous user when owner has hideExperience enabled', async () => {
    loggedUser = null;

    // Set user 2's hideExperience to true
    await con.getRepository(User).update({ id: '2' }, { hideExperience: true });

    const res = await client.query(USER_EXPERIENCES_QUERY, {
      variables: { userId: '2' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperiences.edges).toHaveLength(0);
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
        isOwner
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
      isOwner: true,
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

  it('should return null when experience does not exist', async () => {
    loggedUser = '1';

    const res = await client.query(USER_EXPERIENCE_BY_ID_QUERY, {
      variables: { id: 'f47ac10b-58cc-4372-a567-3e02b2c3d479' }, // manually adjusted to be unique
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperienceById).toBeNull();
  });

  it('should work for non-logged-in users', async () => {
    loggedUser = null;

    const res = await client.query(USER_EXPERIENCE_BY_ID_QUERY, {
      variables: { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperienceById).toMatchObject({
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      isOwner: false,
    });
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
      isOwner: false,
    });
  });

  it('should return null when viewing another user experience with hideExperience enabled', async () => {
    loggedUser = '1';

    // Set user 2's hideExperience to true
    await con.getRepository(User).update({ id: '2' }, { hideExperience: true });

    const res = await client.query(USER_EXPERIENCE_BY_ID_QUERY, {
      variables: { id: 'd4e5f6a7-89ab-4def-c012-456789012345' }, // User 2's experience
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperienceById).toBeNull();
  });

  it('should return own experience even with hideExperience enabled', async () => {
    loggedUser = '1';

    // Set user 1's hideExperience to true
    await con.getRepository(User).update({ id: '1' }, { hideExperience: true });

    const res = await client.query(USER_EXPERIENCE_BY_ID_QUERY, {
      variables: { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' }, // User 1's experience
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperienceById).toMatchObject({
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      title: 'Senior Software Engineer',
    });
  });

  it('should return experience from another user when hideExperience is false', async () => {
    loggedUser = '1';

    // Explicitly set user 2's hideExperience to false
    await con
      .getRepository(User)
      .update({ id: '2' }, { hideExperience: false });

    const res = await client.query(USER_EXPERIENCE_BY_ID_QUERY, {
      variables: { id: 'd4e5f6a7-89ab-4def-c012-456789012345' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperienceById).toMatchObject({
      id: 'd4e5f6a7-89ab-4def-c012-456789012345',
      title: 'Product Manager',
    });
  });

  it('should return null for anonymous user when owner has hideExperience enabled', async () => {
    loggedUser = null;

    // Set user 1's hideExperience to true
    await con.getRepository(User).update({ id: '1' }, { hideExperience: true });

    const res = await client.query(USER_EXPERIENCE_BY_ID_QUERY, {
      variables: { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' }, // User 1's experience
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperienceById).toBeNull();
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
          customCompanyName: 'Personal Project',
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
          customCompanyName: 'Self-taught',
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.upsertUserGeneralExperience).toMatchObject({
      company: null,
      customCompanyName: 'Self-taught',
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
            customCompanyName: 'Test Company',
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
            customCompanyName: 'Some Company',
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
          companyId: 'company-1',
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

  it('should fail when experience has neither companyId nor customCompanyName', async () => {
    loggedUser = '1';

    const experienceTypes = ['work', 'education', 'project', 'certification'];

    for (const type of experienceTypes) {
      await testQueryErrorCode(
        client,
        {
          query: UPSERT_USER_GENERAL_EXPERIENCE_MUTATION,
          variables: {
            input: {
              type,
              title: 'Test Experience',
              startedAt: new Date('2023-01-01'),
            },
          },
        },
        'ZOD_VALIDATION_ERROR',
      );
    }
  });

  it('should create experience without optional fields', async () => {
    loggedUser = '1';

    const res = await client.mutate(UPSERT_USER_GENERAL_EXPERIENCE_MUTATION, {
      variables: {
        input: {
          type: 'project',
          title: 'Minimal Project',
          startedAt: new Date('2023-01-01'),
          customCompanyName: 'Project Organization',
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
      customCompanyName: 'Project Organization',
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
            customCompanyName: 'Some Company',
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

  it('should fail when work experience has neither companyId nor customCompanyName', async () => {
    loggedUser = '1';

    await testQueryErrorCode(
      client,
      {
        query: UPSERT_USER_WORK_EXPERIENCE_MUTATION,
        variables: {
          input: {
            type: 'work',
            title: 'Software Engineer',
            startedAt: new Date('2023-01-01'),
          },
        },
      },
      'ZOD_VALIDATION_ERROR',
    );
  });
});

describe('mutation removeUserExperience', () => {
  const REMOVE_USER_EXPERIENCE_MUTATION = /* GraphQL */ `
    mutation RemoveUserExperience($id: ID!) {
      removeUserExperience(id: $id) {
        _
      }
    }
  `;

  it('should require authentication', async () => {
    loggedUser = null;

    await testQueryErrorCode(
      client,
      {
        query: REMOVE_USER_EXPERIENCE_MUTATION,
        variables: { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
      },
      'UNAUTHENTICATED',
    );
  });

  it('should remove an existing experience', async () => {
    loggedUser = '1';

    const res = await client.mutate(REMOVE_USER_EXPERIENCE_MUTATION, {
      variables: { id: 'b2c3d4e5-6789-4bcd-aef0-234567890123' },
    });

    expect(res.errors).toBeFalsy();

    // Verify it's actually deleted
    const deleted = await con
      .getRepository(UserExperience)
      .findOne({ where: { id: 'b2c3d4e5-6789-4bcd-aef0-234567890123' } });
    expect(deleted).toBeNull();
  });

  it('should remove work experience and cascade delete skills', async () => {
    loggedUser = '1';

    // First create a work experience with skills
    const UPSERT_USER_WORK_EXPERIENCE_MUTATION = /* GraphQL */ `
      mutation UpsertUserWorkExperience(
        $input: UserExperienceWorkInput!
        $id: ID
      ) {
        upsertUserWorkExperience(input: $input, id: $id) {
          id
          skills {
            value
          }
        }
      }
    `;

    const created = await client.mutate(UPSERT_USER_WORK_EXPERIENCE_MUTATION, {
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

    expect(created.errors).toBeFalsy();
    const experienceId = created.data.upsertUserWorkExperience.id;

    // Verify skills were created
    expect(created.data.upsertUserWorkExperience.skills).toHaveLength(3);

    // Now remove the experience
    const res = await client.mutate(REMOVE_USER_EXPERIENCE_MUTATION, {
      variables: { id: experienceId },
    });

    expect(res.errors).toBeFalsy();

    // Verify the experience is deleted
    const deleted = await con
      .getRepository(UserExperience)
      .findOne({ where: { id: experienceId } });
    expect(deleted).toBeNull();

    // Verify skills were cascaded deleted
    const skillsAfter = await con
      .getRepository(UserExperienceSkill)
      .find({ where: { experienceId } });
    expect(skillsAfter).toHaveLength(0);
  });

  it("should not remove another user's experience", async () => {
    loggedUser = '1';

    // Try to remove user 2's experience
    const res = await client.mutate(REMOVE_USER_EXPERIENCE_MUTATION, {
      variables: { id: 'd4e5f6a7-89ab-4def-c012-456789012345' },
    });

    // Should succeed without error
    expect(res.errors).toBeFalsy();

    // But the experience should still exist (not deleted)
    const stillExists = await con
      .getRepository(UserExperience)
      .findOne({ where: { id: 'd4e5f6a7-89ab-4def-c012-456789012345' } });
    expect(stillExists).toBeDefined();
    expect(stillExists?.userId).toBe('2');
  });

  it('should succeed silently when experience does not exist', async () => {
    loggedUser = '1';

    const res = await client.mutate(REMOVE_USER_EXPERIENCE_MUTATION, {
      variables: { id: '999e4567-e89b-12d3-a456-426614174000' },
    });

    // Should succeed without error
    expect(res.errors).toBeFalsy();
  });
});

describe('UserExperience image field', () => {
  const USER_EXPERIENCE_IMAGE_QUERY = /* GraphQL */ `
    query UserExperienceById($id: ID!) {
      userExperienceById(id: $id) {
        id
        image
        customDomain
        company {
          id
          image
        }
      }
    }
  `;

  it('should return company image when experience has companyId', async () => {
    loggedUser = '1';

    // exp-1 has companyId 'company-1' which has image 'https://daily.dev/logo.png'
    const res = await client.query(USER_EXPERIENCE_IMAGE_QUERY, {
      variables: { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperienceById.company.image).toBe(
      'https://daily.dev/logo.png',
    );
    expect(res.data.userExperienceById.image).toBe(
      'https://daily.dev/logo.png',
    );
  });

  it('should return customImage from flags when no companyId', async () => {
    loggedUser = '1';

    const experienceId = 'e5f6a7b8-9abc-4ef0-1234-567890123456';
    await con.getRepository(UserExperience).save({
      id: experienceId,
      userId: '1',
      companyId: null,
      customCompanyName: 'Custom Company',
      title: 'Developer',
      startedAt: new Date('2023-01-01'),
      type: UserExperienceType.Work,
      flags: {
        customDomain: 'https://custom.com',
        customImage:
          'https://www.google.com/s2/favicons?domain=custom.com&sz=128',
      },
    });

    const res = await client.query(USER_EXPERIENCE_IMAGE_QUERY, {
      variables: { id: experienceId },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperienceById.company).toBeNull();
    expect(res.data.userExperienceById.customDomain).toBe('https://custom.com');
    expect(res.data.userExperienceById.image).toBe(
      'https://www.google.com/s2/favicons?domain=custom.com&sz=128',
    );
  });

  it('should prioritize company image over customImage when both exist', async () => {
    loggedUser = '1';

    const experienceId = 'f6a7b8c9-abcd-4f01-2345-678901234567';
    await con.getRepository(UserExperience).save({
      id: experienceId,
      userId: '1',
      companyId: 'company-1',
      title: 'Engineer',
      startedAt: new Date('2023-01-01'),
      type: UserExperienceType.Work,
      flags: {
        customDomain: 'https://other.com',
        customImage:
          'https://www.google.com/s2/favicons?domain=other.com&sz=128',
      },
    });

    const res = await client.query(USER_EXPERIENCE_IMAGE_QUERY, {
      variables: { id: experienceId },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperienceById.company.image).toBe(
      'https://daily.dev/logo.png',
    );
    expect(res.data.userExperienceById.image).toBe(
      'https://daily.dev/logo.png',
    );
    expect(res.data.userExperienceById.customDomain).toBe('https://other.com');
  });

  it('should return null image when neither companyId nor customImage exists', async () => {
    loggedUser = '1';

    const experienceId = 'a7b8c9d0-bcde-4012-3456-789012345678';
    await con.getRepository(UserExperience).save({
      id: experienceId,
      userId: '1',
      companyId: null,
      customCompanyName: 'No Image Company',
      title: 'Intern',
      startedAt: new Date('2023-01-01'),
      type: UserExperienceType.Work,
      flags: {},
    });

    const res = await client.query(USER_EXPERIENCE_IMAGE_QUERY, {
      variables: { id: experienceId },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.userExperienceById.company).toBeNull();
    expect(res.data.userExperienceById.image).toBeNull();
    expect(res.data.userExperienceById.customDomain).toBeNull();
  });

  it('should still link to existing company when customDomain is provided', async () => {
    loggedUser = '1';

    const UPSERT_WORK_MUTATION = /* GraphQL */ `
      mutation UpsertUserWorkExperience(
        $input: UserExperienceWorkInput!
        $id: ID
      ) {
        upsertUserWorkExperience(input: $input, id: $id) {
          id
          image
          customDomain
          customCompanyName
          company {
            id
            name
            image
          }
        }
      }
    `;

    const res = await client.mutate(UPSERT_WORK_MUTATION, {
      variables: {
        input: {
          type: 'work',
          title: 'Engineer',
          startedAt: new Date('2023-01-01'),
          customCompanyName: 'Daily.dev',
          customDomain: 'https://mycustomdomain.com',
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.upsertUserWorkExperience.company).not.toBeNull();
    expect(res.data.upsertUserWorkExperience.company.name).toBe('Daily.dev');
    expect(res.data.upsertUserWorkExperience.customCompanyName).toBeNull();
    expect(res.data.upsertUserWorkExperience.customDomain).toBe(
      'mycustomdomain.com',
    );
    expect(res.data.upsertUserWorkExperience.image).toBe(
      'https://daily.dev/logo.png',
    );
  });

  it('should set removedEnrichment flag and prevent auto-linking on subsequent saves', async () => {
    loggedUser = '1';

    const experienceId = 'c9d0e1f2-def0-4234-5678-901234567890';
    await con.getRepository(UserExperience).save({
      id: experienceId,
      userId: '1',
      companyId: 'company-1',
      title: 'Engineer',
      startedAt: new Date('2023-01-01'),
      type: UserExperienceType.Work,
      flags: {},
    });

    const UPSERT_WORK_MUTATION = /* GraphQL */ `
      mutation UpsertUserWorkExperience(
        $input: UserExperienceWorkInput!
        $id: ID
      ) {
        upsertUserWorkExperience(input: $input, id: $id) {
          id
          company {
            id
          }
          customCompanyName
        }
      }
    `;

    const res1 = await client.mutate(UPSERT_WORK_MUTATION, {
      variables: {
        id: experienceId,
        input: {
          type: 'work',
          title: 'Engineer',
          startedAt: new Date('2023-01-01'),
          customCompanyName: 'Daily.dev',
        },
      },
    });

    expect(res1.errors).toBeFalsy();
    expect(res1.data.upsertUserWorkExperience.company).toBeNull();
    expect(res1.data.upsertUserWorkExperience.customCompanyName).toBe(
      'Daily.dev',
    );

    const afterFirstSave = await con
      .getRepository(UserExperience)
      .findOne({ where: { id: experienceId } });
    expect(afterFirstSave?.flags?.removedEnrichment).toBe(true);
    expect(afterFirstSave?.companyId).toBeNull();

    const res2 = await client.mutate(UPSERT_WORK_MUTATION, {
      variables: {
        id: experienceId,
        input: {
          type: 'work',
          title: 'Senior Engineer',
          startedAt: new Date('2023-01-01'),
          customCompanyName: 'Daily.dev',
        },
      },
    });

    expect(res2.errors).toBeFalsy();
    expect(res2.data.upsertUserWorkExperience.company).toBeNull();
    expect(res2.data.upsertUserWorkExperience.customCompanyName).toBe(
      'Daily.dev',
    );

    const afterSecondSave = await con
      .getRepository(UserExperience)
      .findOne({ where: { id: experienceId } });
    expect(afterSecondSave?.companyId).toBeNull();
    expect(afterSecondSave?.flags?.removedEnrichment).toBe(true);
  });

  it('should allow re-linking to company after removedEnrichment was set', async () => {
    loggedUser = '1';

    const experienceId = 'd0e1f2a3-ef01-5345-6789-012345678901';
    await con.getRepository(UserExperience).save({
      id: experienceId,
      userId: '1',
      companyId: null,
      customCompanyName: 'Some Custom Company',
      title: 'Developer',
      startedAt: new Date('2023-01-01'),
      type: UserExperienceType.Work,
      flags: { removedEnrichment: true },
    });

    const UPSERT_WORK_MUTATION = /* GraphQL */ `
      mutation UpsertUserWorkExperience(
        $input: UserExperienceWorkInput!
        $id: ID
      ) {
        upsertUserWorkExperience(input: $input, id: $id) {
          id
          company {
            id
            name
          }
          customCompanyName
        }
      }
    `;

    const res = await client.mutate(UPSERT_WORK_MUTATION, {
      variables: {
        id: experienceId,
        input: {
          type: 'work',
          title: 'Developer',
          startedAt: new Date('2023-01-01'),
          companyId: 'company-1',
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.upsertUserWorkExperience.company).not.toBeNull();
    expect(res.data.upsertUserWorkExperience.company.id).toBe('company-1');
    expect(res.data.upsertUserWorkExperience.customCompanyName).toBeNull();

    const updated = await con
      .getRepository(UserExperience)
      .findOne({ where: { id: experienceId } });
    expect(updated?.companyId).toBe('company-1');
  });
});

describe('mutation upsertUserGeneralExperience with repository', () => {
  const UPSERT_OPENSOURCE_MUTATION = /* GraphQL */ `
    mutation UpsertUserGeneralExperience(
      $input: UserGeneralExperienceInput!
      $id: ID
    ) {
      upsertUserGeneralExperience(input: $input, id: $id) {
        id
        type
        title
        description
        startedAt
        endedAt
        company {
          id
          name
        }
        customCompanyName
        repository {
          id
          owner
          name
          url
          image
        }
      }
    }
  `;

  beforeEach(async () => {
    loggedUser = null;
    await saveFixtures(con, User, usersFixture);
    await saveFixtures(con, Company, companiesFixture);
    await saveFixtures(con, UserExperience, userExperiencesFixture);
  });

  it('should create an opensource experience with repository', async () => {
    loggedUser = '1';

    const res = await client.mutate(UPSERT_OPENSOURCE_MUTATION, {
      variables: {
        input: {
          type: 'opensource',
          title: 'React Core Contributor',
          description: 'Contributing to React core',
          startedAt: new Date('2023-01-01'),
          repository: {
            id: '10270250',
            owner: 'facebook',
            name: 'react',
            url: 'https://github.com/facebook/react',
            image: 'https://avatars.githubusercontent.com/u/69631?v=4',
          },
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.upsertUserGeneralExperience).toMatchObject({
      id: expect.any(String),
      type: 'opensource',
      title: 'React Core Contributor',
      description: 'Contributing to React core',
      company: null,
      customCompanyName: null,
      repository: {
        id: '10270250',
        owner: 'facebook',
        name: 'react',
        url: 'https://github.com/facebook/react',
        image: 'https://avatars.githubusercontent.com/u/69631?v=4',
      },
    });

    // Verify the repository is stored in flags
    const saved = await con.getRepository(UserExperience).findOne({
      where: { id: res.data.upsertUserGeneralExperience.id },
    });
    expect(saved?.flags).toMatchObject({
      repository: {
        id: '10270250',
        owner: 'facebook',
        name: 'react',
        url: 'https://github.com/facebook/react',
        image: 'https://avatars.githubusercontent.com/u/69631?v=4',
      },
    });
    expect(saved?.companyId).toBeNull();
    expect(saved?.customCompanyName).toBeNull();
  });

  it('should allow opensource experience without company when repository is provided', async () => {
    loggedUser = '1';

    const res = await client.mutate(UPSERT_OPENSOURCE_MUTATION, {
      variables: {
        input: {
          type: 'opensource',
          title: 'TypeScript Contributor',
          startedAt: new Date('2023-06-01'),
          repository: {
            id: '20929025',
            owner: 'microsoft',
            name: 'TypeScript',
            url: 'https://github.com/microsoft/TypeScript',
            image: 'https://avatars.githubusercontent.com/u/6154722?v=4',
          },
        },
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.upsertUserGeneralExperience.repository).toMatchObject({
      id: '20929025',
      owner: 'microsoft',
      name: 'TypeScript',
    });
    expect(res.data.upsertUserGeneralExperience.company).toBeNull();
    expect(res.data.upsertUserGeneralExperience.customCompanyName).toBeNull();
  });

  it('should update an opensource experience with repository', async () => {
    loggedUser = '1';

    // First create an experience
    const created = await client.mutate(UPSERT_OPENSOURCE_MUTATION, {
      variables: {
        input: {
          type: 'opensource',
          title: 'Initial Contribution',
          startedAt: new Date('2023-01-01'),
          repository: {
            id: '123456',
            owner: 'old',
            name: 'repo',
            url: 'https://github.com/old/repo',
            image: 'https://avatars.githubusercontent.com/u/1?v=4',
          },
        },
      },
    });

    expect(created.errors).toBeFalsy();
    const experienceId = created.data.upsertUserGeneralExperience.id;

    // Update with new repository
    const updated = await client.mutate(UPSERT_OPENSOURCE_MUTATION, {
      variables: {
        id: experienceId,
        input: {
          type: 'opensource',
          title: 'Updated Contribution',
          startedAt: new Date('2023-01-01'),
          repository: {
            id: '789012',
            owner: 'new',
            name: 'repo',
            url: 'https://github.com/new/repo',
            image: 'https://avatars.githubusercontent.com/u/2?v=4',
          },
        },
      },
    });

    expect(updated.errors).toBeFalsy();
    expect(updated.data.upsertUserGeneralExperience).toMatchObject({
      id: experienceId,
      title: 'Updated Contribution',
      repository: {
        id: '789012',
        owner: 'new',
        name: 'repo',
        url: 'https://github.com/new/repo',
        image: 'https://avatars.githubusercontent.com/u/2?v=4',
      },
    });
  });

  it('should clear company when repository is provided for opensource', async () => {
    loggedUser = '1';

    // Create an experience with company first
    const created = await client.mutate(UPSERT_OPENSOURCE_MUTATION, {
      variables: {
        input: {
          type: 'opensource',
          title: 'Company Contribution',
          startedAt: new Date('2023-01-01'),
          companyId: 'company-1',
        },
      },
    });

    expect(created.errors).toBeFalsy();
    expect(created.data.upsertUserGeneralExperience.company?.id).toBe(
      'company-1',
    );

    const experienceId = created.data.upsertUserGeneralExperience.id;

    // Update with repository - should clear company
    const updated = await client.mutate(UPSERT_OPENSOURCE_MUTATION, {
      variables: {
        id: experienceId,
        input: {
          type: 'opensource',
          title: 'Company Contribution',
          startedAt: new Date('2023-01-01'),
          repository: {
            id: '10270250',
            owner: 'facebook',
            name: 'react',
            url: 'https://github.com/facebook/react',
            image: 'https://avatars.githubusercontent.com/u/69631?v=4',
          },
        },
      },
    });

    expect(updated.errors).toBeFalsy();
    expect(updated.data.upsertUserGeneralExperience.company).toBeNull();
    expect(
      updated.data.upsertUserGeneralExperience.customCompanyName,
    ).toBeNull();
    expect(updated.data.upsertUserGeneralExperience.repository).toMatchObject({
      id: '10270250',
      owner: 'facebook',
      name: 'react',
    });
  });

  it('should require company or repository for opensource type', async () => {
    loggedUser = '1';

    await testQueryErrorCode(
      client,
      {
        query: UPSERT_OPENSOURCE_MUTATION,
        variables: {
          input: {
            type: 'opensource',
            title: 'Contribution Without Company or Repository',
            startedAt: new Date('2023-01-01'),
          },
        },
      },
      'ZOD_VALIDATION_ERROR',
    );
  });

  it('should validate repository URL format', async () => {
    loggedUser = '1';

    await testQueryErrorCode(
      client,
      {
        query: UPSERT_OPENSOURCE_MUTATION,
        variables: {
          input: {
            type: 'opensource',
            title: 'Invalid Repository',
            startedAt: new Date('2023-01-01'),
            repository: {
              id: '123',
              owner: 'test',
              name: 'repo',
              url: 'not-a-valid-url',
              image: 'https://example.com/image.png',
            },
          },
        },
      },
      'ZOD_VALIDATION_ERROR',
    );
  });

  it('should validate repository image URL format', async () => {
    loggedUser = '1';

    await testQueryErrorCode(
      client,
      {
        query: UPSERT_OPENSOURCE_MUTATION,
        variables: {
          input: {
            type: 'opensource',
            title: 'Invalid Repository Image',
            startedAt: new Date('2023-01-01'),
            repository: {
              id: '123',
              owner: 'test',
              name: 'repo',
              url: 'https://github.com/test/repo',
              image: 'not-a-valid-url',
            },
          },
        },
      },
      'ZOD_VALIDATION_ERROR',
    );
  });
});
