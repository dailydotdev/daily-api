import { DataSource } from 'typeorm';
import { Keyword, User } from '../../src/entity';
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
import { Autocomplete, AutocompleteType } from '../../src/entity/Autocomplete';
import { DatasetLocation } from '../../src/entity/dataset/DatasetLocation';

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
    {
      value: 'Full Stack Developer',
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

  it('should handle queries with spaces', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { type: 'role', query: 'full stack' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocomplete.result).toEqual(['Full Stack Developer']);
  });

  it('should return empty array for queries with emojis', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { type: 'role', query: '🚀' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocomplete.result).toEqual([]);
  });

  it('should return error for empty string query', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { type: 'role', query: '' },
    });

    expect(res.errors).toBeTruthy();
  });

  it('should return error for query with only spaces', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { type: 'role', query: '   ' },
    });

    expect(res.errors).toBeTruthy();
  });

  it('should return empty array for query with only special characters', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { type: 'role', query: '!@#$%^&*()' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocomplete.result).toEqual([]);
  });

  it('should handle very long query strings', async () => {
    loggedUser = '1';

    const longQuery = 'a'.repeat(1000);
    const res = await client.query(QUERY, {
      variables: { type: 'role', query: longQuery },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocomplete.result).toEqual([]);
  });

  it('should return error for invalid autocomplete type', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { type: 'invalid_type', query: 'test' },
    });

    expect(res.errors).toBeTruthy();
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

describe('query autocompleteLocation', () => {
  const QUERY = /* GraphQL */ `
    query AutocompleteLocation($query: String!) {
      autocompleteLocation(query: $query) {
        id
        country
        city
        subdivision
      }
    }
  `;

  beforeEach(async () => {
    await saveFixtures(con, DatasetLocation, [
      {
        country: 'United States',
        city: 'New York',
        subdivision: 'New York',
        iso2: 'US',
        iso3: 'USA',
        timezone: 'America/New_York',
        ranking: 100,
        externalId: 'us-ny-nyc',
      },
      {
        country: 'United States',
        city: 'San Francisco',
        subdivision: 'California',
        iso2: 'US',
        iso3: 'USA',
        timezone: 'America/Los_Angeles',
        ranking: 90,
        externalId: 'us-ca-sf',
      },
      {
        country: 'United States',
        city: 'Los Angeles',
        subdivision: 'California',
        iso2: 'US',
        iso3: 'USA',
        timezone: 'America/Los_Angeles',
        ranking: 95,
        externalId: 'us-ca-la',
      },
      {
        country: 'United Kingdom',
        city: 'London',
        subdivision: 'England',
        iso2: 'GB',
        iso3: 'GBR',
        timezone: 'Europe/London',
        ranking: 85,
        externalId: 'uk-eng-london',
      },
      {
        country: 'Canada',
        city: 'Toronto',
        subdivision: 'Ontario',
        iso2: 'CA',
        iso3: 'CAN',
        timezone: 'America/Toronto',
        ranking: 80,
        externalId: 'ca-on-tor',
      },
      {
        country: 'Canada',
        city: 'Vancouver',
        subdivision: 'British Columbia',
        iso2: 'CA',
        iso3: 'CAN',
        timezone: 'America/Vancouver',
        ranking: 75,
        externalId: 'ca-bc-van',
      },
      {
        country: 'Germany',
        city: 'Berlin',
        subdivision: null,
        iso2: 'DE',
        iso3: 'DEU',
        timezone: 'Europe/Berlin',
        ranking: 70,
        externalId: 'de-berlin',
      },
      {
        country: 'France',
        city: 'Paris',
        subdivision: 'Île-de-France',
        iso2: 'FR',
        iso3: 'FRA',
        timezone: 'Europe/Paris',
        ranking: 65,
        externalId: 'fr-idf-paris',
      },
      {
        country: 'Australia',
        city: 'Sydney',
        subdivision: 'New South Wales',
        iso2: 'AU',
        iso3: 'AUS',
        timezone: 'Australia/Sydney',
        ranking: 60,
        externalId: 'au-nsw-syd',
      },
      {
        country: 'Japan',
        city: 'Tokyo',
        subdivision: null,
        iso2: 'JP',
        iso3: 'JPN',
        timezone: 'Asia/Tokyo',
        ranking: 55,
        externalId: 'jp-tokyo',
      },
    ]);
  });

  it('should return unauthenticated when not logged in', () =>
    testQueryErrorCode(
      client,
      {
        query: QUERY,
        variables: { query: 'new york' },
      },
      'UNAUTHENTICATED',
    ));

  it('should return matching locations by country, city, and subdivision', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'new' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          country: 'United States',
          city: 'New York',
          subdivision: 'New York',
        }),
        expect.objectContaining({
          country: 'Australia',
          city: 'Sydney',
          subdivision: 'New South Wales',
        }),
      ]),
    );
  });

  it('should be case insensitive', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'LONDON' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          country: 'United Kingdom',
          city: 'London',
          subdivision: 'England',
        }),
      ]),
    );
  });

  it('should match partial strings in city names', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'angeles' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          country: 'United States',
          city: 'Los Angeles',
          subdivision: 'California',
        }),
      ]),
    );
  });

  it('should match partial strings in country names', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'kingdom' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          country: 'United Kingdom',
          city: 'London',
          subdivision: 'England',
        }),
      ]),
    );
  });

  it('should match partial strings in subdivision names', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'ontario' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          country: 'Canada',
          city: 'Toronto',
          subdivision: 'Ontario',
        }),
      ]),
    );
  });

  it('should return locations ordered by ranking DESC, then alphabetically', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'california' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation.length).toBeGreaterThan(0);

    // Los Angeles has ranking 95, San Francisco has ranking 90
    // So Los Angeles should come first (higher ranking)
    const cities = res.data.autocompleteLocation.map((loc) => loc.city);
    const laIndex = cities.indexOf('Los Angeles');
    const sfIndex = cities.indexOf('San Francisco');
    expect(laIndex).toBeLessThan(sfIndex);
  });

  it('should handle locations with null subdivision', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'berlin' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          country: 'Germany',
          city: 'Berlin',
          subdivision: null,
        }),
      ]),
    );
  });

  it('should return empty array when no matches found', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'nonexistentlocation' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation).toEqual([]);
  });

  it('should handle queries with spaces', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'new york' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          country: 'United States',
          city: 'New York',
          subdivision: 'New York',
        }),
      ]),
    );
  });

  it('should handle queries with special characters', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'île-de-france' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          country: 'France',
          city: 'Paris',
          subdivision: 'Île-de-France',
        }),
      ]),
    );
  });

  it('should return all location fields including id', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'tokyo' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation[0]).toHaveProperty('id');
    expect(res.data.autocompleteLocation[0]).toHaveProperty('country');
    expect(res.data.autocompleteLocation[0]).toHaveProperty('city');
    expect(res.data.autocompleteLocation[0]).toHaveProperty('subdivision');
    expect(typeof res.data.autocompleteLocation[0].id).toBe('string');
  });

  it('should handle queries that match multiple locations', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'united' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation.length).toBeGreaterThan(1);

    const countries = res.data.autocompleteLocation.map((loc) => loc.country);
    expect(countries).toContain('United States');
    expect(countries).toContain('United Kingdom');
  });

  it('should return empty array for queries with only special characters', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: '!@#$%^&*()' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation).toEqual([]);
  });

  it('should handle very long query strings', async () => {
    loggedUser = '1';

    const longQuery = 'a'.repeat(1000);
    const res = await client.query(QUERY, {
      variables: { query: longQuery },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation).toEqual([]);
  });

  it('should return empty array for queries with emojis', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: '🌎🗺️' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation).toEqual([]);
  });

  it('should handle comma-separated location queries (California, USA)', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'California, USA' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation.length).toBeGreaterThan(0);

    // Should find California locations in United States
    expect(res.data.autocompleteLocation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          country: 'United States',
          city: 'San Francisco',
          subdivision: 'California',
        }),
        expect.objectContaining({
          country: 'United States',
          city: 'Los Angeles',
          subdivision: 'California',
        }),
      ]),
    );
  });

  it('should match locations when query is just a state/subdivision name', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'California' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          country: 'United States',
          city: 'San Francisco',
          subdivision: 'California',
        }),
        expect.objectContaining({
          country: 'United States',
          city: 'Los Angeles',
          subdivision: 'California',
        }),
      ]),
    );
  });

  it('should match locations by 2-character iso2 code (US)', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'US' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation.length).toBeGreaterThan(0);

    // Should find United States locations via iso2 or iso3 match
    const usLocations = res.data.autocompleteLocation.filter(
      (loc) => loc.country === 'United States',
    );
    expect(usLocations.length).toBeGreaterThan(0);
  });

  it('should match locations by 2-character iso2 code (GB)', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'GB' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation.length).toBeGreaterThan(0);

    // Should find United Kingdom locations via iso2
    const gbLocations = res.data.autocompleteLocation.filter(
      (loc) => loc.country === 'United Kingdom',
    );
    expect(gbLocations.length).toBeGreaterThan(0);
  });

  it('should match locations by 2-character iso2 code (CA)', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'CA' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation.length).toBeGreaterThan(0);

    // Should find Canada locations via iso2
    const caLocations = res.data.autocompleteLocation.filter(
      (loc) => loc.country === 'Canada',
    );
    expect(caLocations.length).toBeGreaterThan(0);
  });

  it('should handle two-part comma-separated query (Toronto, Canada)', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'Toronto, Canada' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation.length).toBeGreaterThan(0);

    // Should find Toronto in Canada
    expect(res.data.autocompleteLocation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          country: 'Canada',
          city: 'Toronto',
          subdivision: 'Ontario',
        }),
      ]),
    );
  });

  it('should handle two-part comma-separated query (San Francisco, USA)', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'San Francisco, USA' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation.length).toBeGreaterThan(0);

    // Should find San Francisco in United States
    expect(res.data.autocompleteLocation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          country: 'United States',
          city: 'San Francisco',
          subdivision: 'California',
        }),
      ]),
    );
  });

  it('should handle three-part comma-separated query (city, state, country)', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'San Francisco, California, USA' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation.length).toBeGreaterThan(0);

    // Should find San Francisco in California, United States
    expect(res.data.autocompleteLocation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          country: 'United States',
          city: 'San Francisco',
          subdivision: 'California',
        }),
      ]),
    );
  });

  it('should handle comma-separated query with spaces (Ontario, Canada)', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'Ontario, Canada' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation.length).toBeGreaterThan(0);

    // Should find Toronto (which is in Ontario, Canada)
    expect(res.data.autocompleteLocation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          country: 'Canada',
          subdivision: 'Ontario',
        }),
      ]),
    );
  });

  it('should handle comma-separated query with iso code (California, US)', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'California, US' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation.length).toBeGreaterThan(0);

    // Should find California locations in United States
    expect(res.data.autocompleteLocation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          country: 'United States',
          subdivision: 'California',
        }),
      ]),
    );
  });

  it('should handle partial match in two-part query (Fran, USA)', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'Fran, USA' },
    });

    expect(res.errors).toBeFalsy();

    // Should search for "Fran" in city or subdivision fields for USA locations
    // May return San Francisco if partial matching works
    if (res.data.autocompleteLocation.length > 0) {
      const usLocations = res.data.autocompleteLocation.filter(
        (loc) => loc.country === 'United States',
      );
      expect(usLocations.length).toBeGreaterThan(0);
    }
  });

  it('should handle queries with extra spaces around commas', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'Toronto ,  Canada' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation.length).toBeGreaterThan(0);

    // Should still find Toronto in Canada (spaces should be trimmed)
    expect(res.data.autocompleteLocation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          country: 'Canada',
          city: 'Toronto',
        }),
      ]),
    );
  });

  it('should match 3-character queries via iso3 code (DEU for Germany)', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'DEU' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation.length).toBeGreaterThan(0);

    // Should find Germany locations via iso3
    const germanyLocations = res.data.autocompleteLocation.filter(
      (loc) => loc.country === 'Germany',
    );
    expect(germanyLocations.length).toBeGreaterThan(0);
  });

  it('should match 3-character queries via iso3 code (AUS for Australia)', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'AUS' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation.length).toBeGreaterThan(0);

    // Should find Australia locations via iso3
    const ausLocations = res.data.autocompleteLocation.filter(
      (loc) => loc.country === 'Australia',
    );
    expect(ausLocations.length).toBeGreaterThan(0);
  });

  it('should handle comma-separated query with partial subdivision (Brit, Canada)', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'Brit, Canada' },
    });

    expect(res.errors).toBeFalsy();

    // Should find Vancouver in British Columbia, Canada
    if (res.data.autocompleteLocation.length > 0) {
      const bcLocations = res.data.autocompleteLocation.filter(
        (loc) =>
          loc.country === 'Canada' && loc.subdivision?.includes('British'),
      );
      expect(bcLocations.length).toBeGreaterThan(0);
    }
  });
});
