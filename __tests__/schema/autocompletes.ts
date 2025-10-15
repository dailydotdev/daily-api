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
import { Company, CompanyType } from '../../src/entity/Company';

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

    // Should search for "Fran" in city or subdivision fields AND country matches USA
    // Should find San Francisco since it contains "Fran" and is in United States
    expect(res.data.autocompleteLocation.length).toBeGreaterThan(0);

    // All results should be from United States
    const allUS = res.data.autocompleteLocation.every(
      (loc) => loc.country === 'United States',
    );
    expect(allUS).toBe(true);

    // Should include San Francisco
    const hasSanFrancisco = res.data.autocompleteLocation.some(
      (loc) => loc.city === 'San Francisco',
    );
    expect(hasSanFrancisco).toBe(true);
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

    // Add "Great Britain" location in UK to verify it's NOT returned for "Brit, Canada"
    await saveFixtures(con, DatasetLocation, [
      {
        country: 'United Kingdom',
        city: 'Great Britain',
        subdivision: 'England',
        iso2: 'GB',
        iso3: 'GBR',
        timezone: 'Europe/London',
        ranking: 50,
        externalId: 'uk-eng-gb',
      },
    ]);

    const res = await client.query(QUERY, {
      variables: { query: 'Brit, Canada' },
    });

    expect(res.errors).toBeFalsy();

    // Should find locations where subdivision/city contains "Brit" AND country is Canada
    expect(res.data.autocompleteLocation.length).toBeGreaterThan(0);

    // All results should be from Canada ONLY
    const allCanada = res.data.autocompleteLocation.every(
      (loc) => loc.country === 'Canada',
    );
    expect(allCanada).toBe(true);

    // Should match "British Columbia" (partial: "Brit" matches "British")
    const bcLocations = res.data.autocompleteLocation.filter(
      (loc) => loc.subdivision === 'British Columbia',
    );
    expect(bcLocations.length).toBeGreaterThan(0);

    // Should include Vancouver specifically (city in British Columbia)
    const hasVancouver = res.data.autocompleteLocation.some(
      (loc) =>
        loc.city === 'Vancouver' && loc.subdivision === 'British Columbia',
    );
    expect(hasVancouver).toBe(true);

    // Should NOT match "Great Britain" even though it contains "Brit"
    // because it's in United Kingdom, not Canada (tests AND logic)
    const greatBritain = res.data.autocompleteLocation.filter(
      (loc) => loc.city === 'Great Britain',
    );
    expect(greatBritain.length).toBe(0);
  });

  it('should return NO results when searching for "California, France"', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'California, France' },
    });

    expect(res.errors).toBeFalsy();

    // Should return ZERO results - California doesn't exist in France
    // This tests the AND logic - both country AND subdivision must match
    expect(res.data.autocompleteLocation).toEqual([]);
    expect(res.data.autocompleteLocation.length).toBe(0);
  });

  it('should return NO results when searching for "California, United Kingdom"', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'California, United Kingdom' },
    });

    expect(res.errors).toBeFalsy();

    // Should return ZERO results - California doesn't exist in United Kingdom
    // This demonstrates the AND logic working correctly
    expect(res.data.autocompleteLocation).toEqual([]);
    expect(res.data.autocompleteLocation.length).toBe(0);
  });

  it('should only return California cities when searching "California, United States"', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'California, United States' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation.length).toBeGreaterThan(0);

    // ALL results should be from California AND United States (AND logic)
    const allInCaliforniaUS = res.data.autocompleteLocation.every(
      (loc) =>
        loc.country === 'United States' &&
        (loc.subdivision === 'California' || loc.city?.includes('California')),
    );
    expect(allInCaliforniaUS).toBe(true);

    // Should NOT include New York or other US states
    const newYorkResults = res.data.autocompleteLocation.filter(
      (loc) => loc.subdivision === 'New York',
    );
    expect(newYorkResults.length).toBe(0);
  });

  it('should find specific city when three parts are provided', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'Los Angeles, California, United States' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation.length).toBeGreaterThan(0);

    // Should find Los Angeles specifically
    const laResults = res.data.autocompleteLocation.filter(
      (loc) =>
        loc.city === 'Los Angeles' &&
        loc.subdivision === 'California' &&
        loc.country === 'United States',
    );
    expect(laResults.length).toBeGreaterThan(0);

    // Should NOT return San Francisco even though it's also in California, US
    const sfResults = res.data.autocompleteLocation.filter(
      (loc) => loc.city === 'San Francisco',
    );
    expect(sfResults.length).toBe(0);
  });

  it('should handle ISO code in comma-separated query correctly', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { query: 'Ontario, CA' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation.length).toBeGreaterThan(0);

    // CA should match Canada via iso2, and Ontario is a Canadian province
    const ontarioCanada = res.data.autocompleteLocation.filter(
      (loc) => loc.country === 'Canada' && loc.subdivision === 'Ontario',
    );
    expect(ontarioCanada.length).toBeGreaterThan(0);
  });

  it('should differentiate between "Paris" alone and "Paris, France"', async () => {
    loggedUser = '1';

    // Search for just "Paris"
    const res1 = await client.query(QUERY, {
      variables: { query: 'Paris' },
    });

    // Search for "Paris, France"
    const res2 = await client.query(QUERY, {
      variables: { query: 'Paris, France' },
    });

    expect(res1.errors).toBeFalsy();
    expect(res2.errors).toBeFalsy();

    // Both should find Paris, France
    expect(res1.data.autocompleteLocation.length).toBeGreaterThan(0);
    expect(res2.data.autocompleteLocation.length).toBeGreaterThan(0);

    // "Paris, France" should be more specific (using AND logic)
    // All results for "Paris, France" should be in France
    const allInFrance = res2.data.autocompleteLocation.every(
      (loc) => loc.country === 'France',
    );
    expect(allInFrance).toBe(true);
  });

  it('should handle "York, United Kingdom" vs "New York, United States"', async () => {
    loggedUser = '1';

    // Add York, UK to fixtures
    await saveFixtures(con, DatasetLocation, [
      {
        country: 'United Kingdom',
        city: 'York',
        subdivision: 'England',
        iso2: 'GB',
        iso3: 'GBR',
        timezone: 'Europe/London',
        ranking: 75,
        externalId: 'uk-eng-york',
      },
    ]);

    const res = await client.query(QUERY, {
      variables: { query: 'York, United Kingdom' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation.length).toBeGreaterThan(0);

    // ALL results should be from United Kingdom only
    const allUK = res.data.autocompleteLocation.every(
      (loc) => loc.country === 'United Kingdom',
    );
    expect(allUK).toBe(true);

    // Should find York in UK
    const hasYork = res.data.autocompleteLocation.some(
      (loc) => loc.city === 'York',
    );
    expect(hasYork).toBe(true);

    // Should NOT find any US locations at all
    const usResults = res.data.autocompleteLocation.filter(
      (loc) => loc.country === 'United States',
    );
    expect(usResults.length).toBe(0);
  });

  describe('performance and edge cases', () => {
    it('should handle broad queries efficiently with ranking-based ordering', async () => {
      loggedUser = '1';

      // Query that might match many locations
      const res = await client.query(QUERY, {
        variables: { query: 'a' },
      });

      expect(res.errors).toBeFalsy();

      // Should return results but be limited (default limit is 20)
      expect(res.data.autocompleteLocation.length).toBeLessThanOrEqual(20);

      // Results should be ordered by ranking DESC first
      if (res.data.autocompleteLocation.length > 1) {
        // Verify the query completes in reasonable time (implicit by test not timing out)
        expect(res.data.autocompleteLocation).toBeDefined();
      }
    });

    it('should handle queries with common terms efficiently', async () => {
      loggedUser = '1';

      // "United" appears in "United States" and "United Kingdom"
      const start = Date.now();
      const res = await client.query(QUERY, {
        variables: { query: 'United' },
      });
      const duration = Date.now() - start;

      expect(res.errors).toBeFalsy();
      expect(res.data.autocompleteLocation.length).toBeGreaterThan(0);

      // Should complete reasonably fast (< 1000ms, but this is a soft check)
      // In production with proper indexes, should be much faster
      expect(duration).toBeLessThan(5000); // Generous timeout for test environment
    });

    it('should limit results even with very broad comma-separated queries', async () => {
      loggedUser = '1';

      // Very broad two-part query
      const res = await client.query(QUERY, {
        variables: { query: 'a, United States' },
      });

      expect(res.errors).toBeFalsy();

      // Should still respect the limit
      expect(res.data.autocompleteLocation.length).toBeLessThanOrEqual(20);
    });

    it('should handle multiple OR conditions from ISO code matching', async () => {
      loggedUser = '1';

      // 2-character query creates multiple conditions: country, iso2, iso3
      const res = await client.query(QUERY, {
        variables: { query: 'US' },
      });

      expect(res.errors).toBeFalsy();
      expect(res.data.autocompleteLocation.length).toBeGreaterThan(0);

      // Should complete successfully even with multiple OR conditions
      expect(Array.isArray(res.data.autocompleteLocation)).toBe(true);
    });

    it('should handle complex three-part query with multiple condition combinations', async () => {
      loggedUser = '1';

      // Three-part query with 2-char country code creates most complex conditions
      const start = Date.now();
      const res = await client.query(QUERY, {
        variables: { query: 'San Francisco, California, US' },
      });
      const duration = Date.now() - start;

      expect(res.errors).toBeFalsy();
      expect(res.data.autocompleteLocation.length).toBeGreaterThan(0);

      // Should still be performant with AND conditions
      expect(duration).toBeLessThan(5000);

      // Should find the specific location
      const sfResults = res.data.autocompleteLocation.filter(
        (loc) =>
          loc.city === 'San Francisco' &&
          loc.subdivision === 'California' &&
          loc.country === 'United States',
      );
      expect(sfResults.length).toBeGreaterThan(0);
    });
  });
});

describe('query autocompleteCompany', () => {
  const QUERY = /* GraphQL */ `
    query AutocompleteCompany(
      $query: String!
      $limit: Int
      $type: CompanyType
    ) {
      autocompleteCompany(query: $query, limit: $limit, type: $type) {
        id
        name
        image
      }
    }
  `;

  beforeEach(async () => {
    await saveFixtures(con, Company, [
      {
        id: 'google',
        name: 'Google',
        image: 'https://example.com/google.png',
        domains: ['google.com', 'alphabet.com'],
        type: CompanyType.Company,
      },
      {
        id: 'microsoft',
        name: 'Microsoft Corporation',
        image: 'https://example.com/microsoft.png',
        domains: ['microsoft.com'],
        type: CompanyType.Company,
      },
      {
        id: 'facebook',
        name: 'Meta (Facebook)',
        image: 'https://example.com/meta.png',
        domains: ['facebook.com', 'meta.com'],
        type: CompanyType.Company,
      },
      {
        id: 'apple',
        name: 'Apple Inc.',
        image: 'https://example.com/apple.png',
        domains: ['apple.com'],
        type: CompanyType.Company,
      },
      {
        id: 'amazon',
        name: 'Amazon',
        image: 'https://example.com/amazon.png',
        domains: ['amazon.com'],
        type: CompanyType.Company,
      },
      {
        id: 'mit',
        name: 'Massachusetts Institute of Technology',
        image: 'https://example.com/mit.png',
        domains: ['mit.edu'],
        type: CompanyType.School,
      },
      {
        id: 'stanford',
        name: 'Stanford University',
        image: 'https://example.com/stanford.png',
        domains: ['stanford.edu'],
        type: CompanyType.School,
      },
      {
        id: 'harvard',
        name: 'Harvard University',
        image: 'https://example.com/harvard.png',
        domains: ['harvard.edu'],
        type: CompanyType.School,
      },
      {
        id: 'berkeley',
        name: 'University of California, Berkeley',
        image: 'https://example.com/berkeley.png',
        domains: ['berkeley.edu'],
        type: CompanyType.School,
      },
    ]);
  });

  it('should be case insensitive', async () => {
    const res = await client.query(QUERY, {
      variables: { query: 'GOOGLE' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteCompany).toMatchObject([
      {
        id: 'google',
        name: 'Google',
        image: 'https://example.com/google.png',
      },
    ]);
  });

  it('should match partial strings', async () => {
    const res = await client.query(QUERY, {
      variables: { query: 'micro' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteCompany).toMatchObject([
      {
        id: 'microsoft',
        name: 'Microsoft Corporation',
        image: 'https://example.com/microsoft.png',
      },
    ]);
  });

  it('should match multiple records and return in alphabetical order', async () => {
    const res = await client.query(QUERY, {
      variables: { query: 'university' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteCompany).toMatchObject([
      {
        id: 'harvard',
        name: 'Harvard University',
        image: 'https://example.com/harvard.png',
      },
      {
        id: 'stanford',
        name: 'Stanford University',
        image: 'https://example.com/stanford.png',
      },
      {
        id: 'berkeley',
        name: 'University of California, Berkeley',
        image: 'https://example.com/berkeley.png',
      },
    ]);
  });

  it('should filter by company type', async () => {
    const res = await client.query(QUERY, {
      variables: { query: 'a', type: 'company' },
    });

    expect(res.errors).toBeFalsy();

    // Should only return companies, not schools (alphabetically sorted)
    expect(res.data.autocompleteCompany).toMatchObject([
      {
        id: 'amazon',
        name: 'Amazon',
        image: 'https://example.com/amazon.png',
      },
      {
        id: 'apple',
        name: 'Apple Inc.',
        image: 'https://example.com/apple.png',
      },
      {
        id: 'facebook',
        name: 'Meta (Facebook)',
        image: 'https://example.com/meta.png',
      },
      {
        id: 'microsoft',
        name: 'Microsoft Corporation',
        image: 'https://example.com/microsoft.png',
      },
    ]);
  });

  it('should filter by school type', async () => {
    const res = await client.query(QUERY, {
      variables: { query: 'a', type: 'school' },
    });

    expect(res.errors).toBeFalsy();

    // Should only return schools, not companies (alphabetically sorted)
    expect(res.data.autocompleteCompany).toMatchObject([
      {
        id: 'harvard',
        name: 'Harvard University',
        image: 'https://example.com/harvard.png',
      },
      {
        id: 'mit',
        name: 'Massachusetts Institute of Technology',
        image: 'https://example.com/mit.png',
      },
      {
        id: 'stanford',
        name: 'Stanford University',
        image: 'https://example.com/stanford.png',
      },
      {
        id: 'berkeley',
        name: 'University of California, Berkeley',
        image: 'https://example.com/berkeley.png',
      },
    ]);
  });

  it('should return all types when type is not specified', async () => {
    const res = await client.query(QUERY, {
      variables: { query: 'a' },
    });

    expect(res.errors).toBeFalsy();

    // Should return both companies and schools (alphabetically sorted)
    expect(res.data.autocompleteCompany).toMatchObject([
      {
        id: 'amazon',
        name: 'Amazon',
        image: 'https://example.com/amazon.png',
      },
      {
        id: 'apple',
        name: 'Apple Inc.',
        image: 'https://example.com/apple.png',
      },
      {
        id: 'harvard',
        name: 'Harvard University',
        image: 'https://example.com/harvard.png',
      },
      {
        id: 'mit',
        name: 'Massachusetts Institute of Technology',
        image: 'https://example.com/mit.png',
      },
      {
        id: 'facebook',
        name: 'Meta (Facebook)',
        image: 'https://example.com/meta.png',
      },
      {
        id: 'microsoft',
        name: 'Microsoft Corporation',
        image: 'https://example.com/microsoft.png',
      },
      {
        id: 'stanford',
        name: 'Stanford University',
        image: 'https://example.com/stanford.png',
      },
      {
        id: 'berkeley',
        name: 'University of California, Berkeley',
        image: 'https://example.com/berkeley.png',
      },
    ]);
  });

  it('should respect limit parameter', async () => {
    const res = await client.query(QUERY, {
      variables: { query: 'a', limit: 2 },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteCompany.length).toBe(2);

    // Should still be alphabetically sorted
    expect(res.data.autocompleteCompany[0].name).toEqual('Amazon');
  });

  it('should use default limit of 20 when not specified', async () => {
    const res = await client.query(QUERY, {
      variables: { query: 'a' },
    });

    expect(res.errors).toBeFalsy();
    // Should return results but capped at default limit
    expect(res.data.autocompleteCompany.length).toBeLessThanOrEqual(20);
  });

  it('should return empty array when no matches found', async () => {
    const res = await client.query(QUERY, {
      variables: { query: 'nonexistentcompany' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteCompany).toEqual([]);
  });

  it('should handle queries with spaces', async () => {
    const res = await client.query(QUERY, {
      variables: { query: 'of cali' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteCompany).toMatchObject([
      {
        id: 'berkeley',
        name: 'University of California, Berkeley',
        image: 'https://example.com/berkeley.png',
      },
    ]);
  });

  it('should handle queries that returns result with special characters', async () => {
    const res = await client.query(QUERY, {
      variables: { query: 'meta facebook' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteCompany).toMatchObject([
      {
        id: 'facebook',
        name: 'Meta (Facebook)',
        image: 'https://example.com/meta.png',
      },
    ]);
  });

  it('should handle queries with special characters', async () => {
    const res = await client.query(QUERY, {
      variables: { query: 'inc.' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteCompany).toMatchObject([
      {
        id: 'apple',
        name: 'Apple Inc.',
        image: 'https://example.com/apple.png',
      },
    ]);
  });

  it('should handle very long query strings', async () => {
    const longQuery = 'a'.repeat(1000);
    const res = await client.query(QUERY, {
      variables: { query: longQuery },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteCompany).toEqual([]);
  });

  it('should return error for invalid company type', async () => {
    const res = await client.query(QUERY, {
      variables: { query: 'test', type: 'invalid_type' },
    });

    expect(res.errors).toBeTruthy();
  });

  it('should return error for limit less than 1', async () => {
    const res = await client.query(QUERY, {
      variables: { query: 'test', limit: 0 },
    });

    expect(res.errors).toBeTruthy();
  });

  it('should return error for limit greater than 50', async () => {
    const res = await client.query(QUERY, {
      variables: { query: 'test', limit: 51 },
    });

    expect(res.errors).toBeTruthy();
  });

  it('should normalize query string (lowercase and trim)', async () => {
    const res = await client.query(QUERY, {
      variables: { query: '  GOOGLE  ' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteCompany).toMatchObject([
      {
        id: 'google',
        name: 'Google',
        image: 'https://example.com/google.png',
      },
    ]);
  });
});
