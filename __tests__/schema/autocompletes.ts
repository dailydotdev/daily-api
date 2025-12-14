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
import { Company, CompanyType } from '../../src/entity/Company';
import type { MapboxResponse } from '../../src/integrations/mapbox/types';
import nock from 'nock';

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

    const longQuery = 'a'.repeat(100);
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

  beforeEach(() => {
    jest.clearAllMocks();
    nock.cleanAll();
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

  it('should return locations from Mapbox API', async () => {
    loggedUser = '1';

    const mockMapboxResponse: MapboxResponse = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            coordinates: [-74.006, 40.7128],
            type: 'Point',
          },
          properties: {
            name: 'New York',
            mapbox_id: 'place.nyc',
            feature_type: 'place',
            place_formatted: 'New York, New York, United States',
            context: {
              country: {
                id: 'country.us',
                name: 'United States',
                country_code: 'US',
                country_code_alpha_3: 'USA',
              },
              region: {
                id: 'region.ny',
                name: 'New York',
                region_code: 'NY',
                region_code_full: 'US-NY',
              },
            },
            coordinates: {
              latitude: 40.7128,
              longitude: -74.006,
            },
            language: 'en',
            maki: 'marker',
            metadata: {},
          },
        },
      ],
      attribution: 'Mapbox',
      response_id: 'test-response-id',
    };

    // Mock the Mapbox API response
    nock('https://api.mapbox.com')
      .get('/search/geocode/v6/forward')
      .query({
        q: 'new york',
        types: 'country,region,place',
        limit: 5,
        access_token: process.env.MAPBOX_ACCESS_TOKEN,
      })
      .reply(200, mockMapboxResponse);

    const res = await client.query(QUERY, {
      variables: { query: 'new york' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation).toEqual([
      {
        id: 'place.nyc',
        country: 'United States',
        city: 'New York',
        subdivision: 'New York',
      },
    ]);

    expect(nock.isDone()).toBe(true);
  });

  it('should handle countries without cities', async () => {
    loggedUser = '1';

    const mockMapboxResponse: MapboxResponse = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            coordinates: [0, 0],
            type: 'Point',
          },
          properties: {
            name: 'United States',
            mapbox_id: 'country.us',
            feature_type: 'country',
            place_formatted: 'United States',
            context: {
              country: {
                id: 'country.us',
                name: 'United States',
                country_code: 'US',
                country_code_alpha_3: 'USA',
              },
            },
            coordinates: {
              latitude: 0,
              longitude: 0,
            },
            language: 'en',
            maki: 'marker',
            metadata: {},
          },
        },
      ],
      attribution: 'Mapbox',
      response_id: 'test-response-id',
    };

    // Mock the Mapbox API response
    nock('https://api.mapbox.com')
      .get('/search/geocode/v6/forward')
      .query({
        q: 'united states',
        types: 'country,region,place',
        limit: 5,
        access_token: process.env.MAPBOX_ACCESS_TOKEN,
      })
      .reply(200, mockMapboxResponse);

    const res = await client.query(QUERY, {
      variables: { query: 'united states' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation).toEqual([
      {
        id: 'country.us',
        country: 'United States',
        city: null,
        subdivision: null,
      },
    ]);
  });

  it('should handle multiple results from Mapbox', async () => {
    loggedUser = '1';

    const mockMapboxResponse: MapboxResponse = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            coordinates: [-122.4194, 37.7749],
            type: 'Point',
          },
          properties: {
            name: 'San Francisco',
            mapbox_id: 'place.sf',
            feature_type: 'place',
            place_formatted: 'San Francisco, California, United States',
            context: {
              country: {
                id: 'country.us',
                name: 'United States',
                country_code: 'US',
                country_code_alpha_3: 'USA',
              },
              region: {
                id: 'region.ca',
                name: 'California',
                region_code: 'CA',
                region_code_full: 'US-CA',
              },
            },
            coordinates: {
              latitude: 37.7749,
              longitude: -122.4194,
            },
            language: 'en',
            maki: 'marker',
            metadata: {},
          },
        },
        {
          type: 'Feature',
          geometry: {
            coordinates: [-118.2437, 34.0522],
            type: 'Point',
          },
          properties: {
            name: 'San Diego',
            mapbox_id: 'place.sd',
            feature_type: 'place',
            place_formatted: 'San Diego, California, United States',
            context: {
              country: {
                id: 'country.us',
                name: 'United States',
                country_code: 'US',
                country_code_alpha_3: 'USA',
              },
              region: {
                id: 'region.ca',
                name: 'California',
                region_code: 'CA',
                region_code_full: 'US-CA',
              },
            },
            coordinates: {
              latitude: 34.0522,
              longitude: -118.2437,
            },
            language: 'en',
            maki: 'marker',
            metadata: {},
          },
        },
      ],
      attribution: 'Mapbox',
      response_id: 'test-response-id',
    };

    // Mock the Mapbox API response
    nock('https://api.mapbox.com')
      .get('/search/geocode/v6/forward')
      .query({
        q: 'san',
        types: 'country,region,place',
        limit: 5,
        access_token: process.env.MAPBOX_ACCESS_TOKEN,
      })
      .reply(200, mockMapboxResponse);

    const res = await client.query(QUERY, {
      variables: { query: 'san' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation).toHaveLength(2);
    expect(res.data.autocompleteLocation).toEqual([
      {
        id: 'place.sf',
        country: 'United States',
        city: 'San Francisco',
        subdivision: 'California',
      },
      {
        id: 'place.sd',
        country: 'United States',
        city: 'San Diego',
        subdivision: 'California',
      },
    ]);
  });

  it('should return empty array when Mapbox API fails', async () => {
    loggedUser = '1';

    // Mock the Mapbox API to return an error
    nock('https://api.mapbox.com')
      .get('/search/geocode/v6/forward')
      .query({
        q: 'test',
        types: 'country,region,place',
        limit: 5,
        access_token: process.env.MAPBOX_ACCESS_TOKEN,
      })
      .reply(500, 'Internal Server Error');

    const res = await client.query(QUERY, {
      variables: { query: 'test' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation).toEqual([]);
  });

  it('should return empty array when Mapbox returns no features', async () => {
    loggedUser = '1';

    const mockMapboxResponse: MapboxResponse = {
      type: 'FeatureCollection',
      features: [],
      attribution: 'Mapbox',
      response_id: 'test-response-id',
    };

    // Mock the Mapbox API response
    nock('https://api.mapbox.com')
      .get('/search/geocode/v6/forward')
      .query({
        q: 'nonexistentlocation',
        types: 'country,region,place',
        limit: 5,
        access_token: process.env.MAPBOX_ACCESS_TOKEN,
      })
      .reply(200, mockMapboxResponse);

    const res = await client.query(QUERY, {
      variables: { query: 'nonexistentlocation' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation).toEqual([]);
  });

  it('should handle API network errors gracefully', async () => {
    loggedUser = '1';

    // Mock a network error
    nock('https://api.mapbox.com')
      .get('/search/geocode/v6/forward')
      .query({
        q: 'test',
        types: 'country,region,place',
        limit: 5,
        access_token: process.env.MAPBOX_ACCESS_TOKEN,
      })
      .replyWithError('Network error');

    const res = await client.query(QUERY, {
      variables: { query: 'test' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation).toEqual([]);
  });

  it('should handle missing subdivision', async () => {
    loggedUser = '1';

    const mockMapboxResponse: MapboxResponse = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            coordinates: [13.405, 52.52],
            type: 'Point',
          },
          properties: {
            name: 'Berlin',
            mapbox_id: 'place.berlin',
            feature_type: 'place',
            place_formatted: 'Berlin, Germany',
            context: {
              country: {
                id: 'country.de',
                name: 'Germany',
                country_code: 'DE',
                country_code_alpha_3: 'DEU',
              },
              // No region data
            },
            coordinates: {
              latitude: 52.52,
              longitude: 13.405,
            },
            language: 'en',
            maki: 'marker',
            metadata: {},
          },
        },
      ],
      attribution: 'Mapbox',
      response_id: 'test-response-id',
    };

    // Mock the Mapbox API response
    nock('https://api.mapbox.com')
      .get('/search/geocode/v6/forward')
      .query({
        q: 'berlin',
        types: 'country,region,place',
        limit: 5,
        access_token: process.env.MAPBOX_ACCESS_TOKEN,
      })
      .reply(200, mockMapboxResponse);

    const res = await client.query(QUERY, {
      variables: { query: 'berlin' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation).toEqual([
      {
        id: 'place.berlin',
        country: 'Germany',
        city: 'Berlin',
        subdivision: null,
      },
    ]);
  });

  it('should encode special characters in query', async () => {
    loggedUser = '1';

    const mockMapboxResponse: MapboxResponse = {
      type: 'FeatureCollection',
      features: [],
      attribution: 'Mapbox',
      response_id: 'test-response-id',
    };

    // Mock the Mapbox API response
    // Note: nock automatically handles URL encoding
    nock('https://api.mapbox.com')
      .get('/search/geocode/v6/forward')
      .query({
        q: 'San Francisco, CA',
        types: 'country,region,place',
        limit: 5,
        access_token: process.env.MAPBOX_ACCESS_TOKEN,
      })
      .reply(200, mockMapboxResponse);

    const res = await client.query(QUERY, {
      variables: { query: 'San Francisco, CA' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteLocation).toEqual([]);
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
        id: 'samsung',
        name: 'Samsung Electronics',
        altName: '삼성전자',
        image: 'https://example.com/samsung.png',
        domains: ['samsung.com'],
        type: CompanyType.Company,
      },
      {
        id: 'toyota',
        name: 'Toyota Motor Corporation',
        altName: 'トヨタ自動車',
        image: 'https://example.com/toyota.png',
        domains: ['toyota.com'],
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
      {
        id: 'todai',
        name: 'The University of Tokyo',
        altName: '東京大学',
        image: 'https://example.com/todai.png',
        domains: ['u-tokyo.ac.jp'],
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
        id: 'todai',
        name: 'The University of Tokyo',
        image: 'https://example.com/todai.png',
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
      {
        id: 'samsung',
        name: 'Samsung Electronics',
        image: 'https://example.com/samsung.png',
      },
      {
        id: 'toyota',
        name: 'Toyota Motor Corporation',
        image: 'https://example.com/toyota.png',
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
        id: 'samsung',
        name: 'Samsung Electronics',
        image: 'https://example.com/samsung.png',
      },
      {
        id: 'stanford',
        name: 'Stanford University',
        image: 'https://example.com/stanford.png',
      },
      {
        id: 'toyota',
        name: 'Toyota Motor Corporation',
        image: 'https://example.com/toyota.png',
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
    const longQuery = 'a'.repeat(100);
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

  it('should return results when searching by English name for company with altName', async () => {
    const res = await client.query(QUERY, {
      variables: { query: 'samsung' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteCompany).toMatchObject([
      {
        id: 'samsung',
        name: 'Samsung Electronics',
        image: 'https://example.com/samsung.png',
      },
    ]);
  });

  it('should return results when searching by non-Latin characters (Korean)', async () => {
    const res = await client.query(QUERY, {
      variables: { query: '삼성' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteCompany).toMatchObject([
      {
        id: 'samsung',
        name: 'Samsung Electronics',
        image: 'https://example.com/samsung.png',
      },
    ]);
  });

  it('should return results when searching by non-Latin characters (Japanese)', async () => {
    const res = await client.query(QUERY, {
      variables: { query: 'トヨタ' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.autocompleteCompany).toMatchObject([
      {
        id: 'toyota',
        name: 'Toyota Motor Corporation',
        image: 'https://example.com/toyota.png',
      },
    ]);
  });

  it('should not return unrelated companies when searching with non-Latin characters', async () => {
    const res = await client.query(QUERY, {
      variables: { query: '삼성' },
    });

    expect(res.errors).toBeFalsy();
    // Should only return Samsung, not other companies with non-Latin altNames
    expect(res.data.autocompleteCompany.length).toBe(1);
    expect(res.data.autocompleteCompany[0].id).toBe('samsung');
  });
});
