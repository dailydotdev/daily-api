import { DataSource } from 'typeorm';
import {
  Autocomplete,
  AutocompleteType,
  Keyword,
  User,
} from '../../src/entity';
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
import { usersFixture } from '../fixture/user';
import { keywordsFixture } from '../fixture/keywords';

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

  // Set up test autocomplete data
  await saveFixtures(con, Autocomplete, [
    {
      value: 'Computer Science',
      type: AutocompleteType.FieldOfStudy,
      enabled: true,
    },
    {
      value: 'Computer Engineering',
      type: AutocompleteType.FieldOfStudy,
      enabled: true,
    },
    {
      value: 'Software Engineering',
      type: AutocompleteType.FieldOfStudy,
      enabled: true,
    },
    {
      value: 'Data Science',
      type: AutocompleteType.FieldOfStudy,
      enabled: true,
    },
    {
      value: 'Mechanical Engineering',
      type: AutocompleteType.FieldOfStudy,
      enabled: false, // Disabled, should not be returned
    },
    {
      value: 'Bachelor of Science',
      type: AutocompleteType.Degree,
      enabled: true,
    },
    {
      value: 'Master of Science',
      type: AutocompleteType.Degree,
      enabled: true,
    },
    {
      value: 'Software Engineer',
      type: AutocompleteType.Role,
      enabled: true,
    },
    {
      value: 'Senior Software Engineer',
      type: AutocompleteType.Role,
      enabled: true,
    },
    {
      value: 'Data Engineer',
      type: AutocompleteType.Role,
      enabled: true,
    },
  ]);
});

describe('query autocomplete', () => {
  const QUERY = `
    query Autocomplete($type: AutocompleteType!, $query: String!) {
      autocomplete(type: $type, query: $query) {
        result
      }
    }
  `;

  it('should return unauthenticated when not logged in', () =>
    testQueryErrorCode(
      client,
      {
        query: QUERY,
        variables: { type: 'field_of_study', query: 'computer' },
      },
      'UNAUTHENTICATED',
    ));

  it('should return matching autocomplete results', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { type: 'field_of_study', query: 'computer' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocomplete.result).toEqual([
      'Computer Engineering',
      'Computer Science',
    ]);
  });

  it('should filter by type', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { type: 'degree', query: 'science' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocomplete.result).toEqual([
      'Bachelor of Science',
      'Master of Science',
    ]);
  });

  it('should be case insensitive', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { type: 'field_of_study', query: 'COMPUTER' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocomplete.result).toEqual([
      'Computer Engineering',
      'Computer Science',
    ]);
  });

  it('should not return disabled autocompletes', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { type: 'field_of_study', query: 'mechanical' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocomplete.result).toEqual([]);
  });

  it('should return results in alphabetical order', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { type: 'role', query: 'engineer' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocomplete.result).toEqual([
      'Data Engineer',
      'Senior Software Engineer',
      'Software Engineer',
    ]);
  });

  it('should return empty array when no matches found', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { type: 'field_of_study', query: 'nonexistent' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocomplete.result).toEqual([]);
  });

  it('should return all results when query matches many items', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { type: 'field_of_study', query: 'science' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocomplete.result).toEqual([
      'Computer Science',
      'Data Science',
    ]);
  });

  it('should match partial strings anywhere in the value', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { type: 'role', query: 'software' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocomplete.result).toEqual([
      'Senior Software Engineer',
      'Software Engineer',
    ]);
  });
});

describe('query autocompleteKeywords', () => {
  const QUERY = /* GraphQL */ `
    query AutocompleteKeywords($query: String!, $limit: Int) {
      autocompleteKeywords(query: $query, limit: $limit) {
        keyword
        title
      }
    }
  `;

  beforeEach(async () => {
    await saveFixtures(con, Keyword, keywordsFixture);
  });

  it('should return autocomplete allowed keywords when not logged in', async () => {
    const res = await client.query(QUERY, {
      variables: {
        query: 'dev',
      },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteKeywords).toEqual(
      expect.arrayContaining([
        { keyword: 'webdev', title: 'Web Development' },
        { keyword: 'development', title: null },
      ]),
    );
  });

  it('should return autocomplete results', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: {
        query: 'dev',
      },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteKeywords).toEqual(
      expect.arrayContaining([
        { keyword: 'webdev', title: 'Web Development' },
        { keyword: 'web-development', title: null },
        { keyword: 'development', title: null },
      ]),
    );
  });

  it('should limit autocomplete results', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: {
        query: 'dev',
        limit: 1,
      },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteKeywords).toEqual([
      { keyword: 'development', title: null },
    ]);
  });
});
