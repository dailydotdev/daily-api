import nock from 'nock';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import createOrGetConnection from '../src/db';
import {
  GraphQLTestClient,
  GraphQLTestingState,
  MockContext,
  disposeGraphQLTesting,
  initializeGraphQLTesting,
  testQueryErrorCode,
} from './helpers';

import { getShortUrl } from '../src/common';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;

jest.mock('../src/common', () => ({
  ...jest.requireActual('../src/common'),
  getShortUrl: jest.fn(),
}));

const mockGetShortUrl = getShortUrl as jest.MockedFunction<typeof getShortUrl>;
mockGetShortUrl.mockImplementation(
  async (): Promise<string> =>
    Promise.resolve(`https://diy.dev/${uuidv4().slice(0, 8)}`),
);

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(() => new MockContext(con));
  client = state.client;
});

beforeEach(async () => {
  nock.cleanAll();
  mockGetShortUrl.mockClear();
});

afterAll(() => disposeGraphQLTesting(state));

describe('query getShortUrl', () => {
  const QUERY = `
    query GetShortUrl($url: String!) {
      getShortUrl(url: $url)
    }
  `;

  it('should not work for invalid URL', () => {
    testQueryErrorCode(
      client,
      {
        query: QUERY,
        variables: { url: 'hh::/not-a-valid-url.test' },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );

    expect(mockGetShortUrl).not.toHaveBeenCalled();
  });

  it('should generate shortened URL', async () => {
    const url = 'https://daily.dev/foo/bar';
    const res = await client.query(QUERY, { variables: { url } });
    expect(res.errors).toBeFalsy();

    expect(mockGetShortUrl).toHaveBeenCalled();

    expect(res.data.getShortUrl).toMatch(
      new RegExp('https://diy.dev/[0-9a-f]{8}$', 'i'),
    );
  });
});
