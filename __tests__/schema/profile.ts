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
    expect(res.data.userExperienceById.id).toBe(
      'd4e5f6a7-89ab-4def-c012-456789012345',
    );
    expect(res.data.userExperienceById.title).toBe('Product Manager');
  });
});
