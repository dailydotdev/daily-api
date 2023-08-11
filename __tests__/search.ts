import {
  disposeGraphQLTesting,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  testMutationErrorCode,
  testQueryErrorCode,
} from './helpers';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import nock from 'nock';
import { GraphQLTestClient } from './helpers';
import { magniOrigin, SearchResultFeedback } from '../src/integrations';

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
});

describe('searchResultFeedback mutation', () => {
  const chunkId = 'chunk';

  const mockFeedback = (params: SearchResultFeedback) => {
    nock(magniOrigin)
      .post('/feedback')
      .matchHeader('Content-Type', 'application/json')
      .matchHeader('X-User-Id', loggedUser)
      .reply(204, params);
  };

  const MUTATION = `
    mutation SearchResultFeedback($chunkId: String!, $value: Int!) {
      searchResultFeedback(chunkId: $chunkId, value: $value) {
        _
      }
    }
  `;

  it('should not authorize when not logged in', async () =>
    testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { chunkId, value: 1 } },
      'UNAUTHENTICATED',
    ));

  it('should throw validation error when value is greater than 1', async () => {
    loggedUser = '1';

    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { chunkId, value: 2 } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should throw validation error when value is less than -1', async () => {
    loggedUser = '1';

    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { chunkId, value: -2 } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should throw validation error when chunk id is missing', async () => {
    loggedUser = '1';

    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { value: 2 } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should send feedback to magni if all values are valid', async () => {
    loggedUser = '1';

    mockFeedback({ value: 1, chunkId });

    const res = await client.mutate(MUTATION, {
      variables: { chunkId, value: 1 },
    });

    expect(res.errors).toBeFalsy();
  });
});

describe('searchSessionHistory query', () => {
  const mockResponse = {
    sessions: [
      {
        id: 'unique id',
        prompt: 'the first question',
        createdAt: new Date(2023, 7, 11).toString(),
      },
    ],
  };

  const mockHistory = (limit = 30, lastId?: string) => {
    const params = new URLSearchParams({ limit: limit.toString() });

    if (lastId) params.append('lastId', lastId);

    nock(magniOrigin)
      .get(`/sessions?${params.toString()}`)
      .matchHeader('X-User-Id', loggedUser)
      .reply(200, mockResponse);
  };

  const QUERY = `
    query SearchSessionHistory($limit: Int, $lastId: String) {
      searchSessionHistory(limit: $limit, lastId: $lastId) {
        id
        prompt
        createdAt
      }
    }
  `;

  it('should not authorize when not logged in', async () =>
    testQueryErrorCode(client, { query: QUERY }, 'UNAUTHENTICATED'));

  it('should get user search history with limit', async () => {
    loggedUser = '1';

    const limit = 20;

    mockHistory(limit);

    const res = await client.mutate(QUERY, { variables: { limit } });

    expect(res.errors).toBeFalsy();
  });

  it('should get user search history with limit and last id', async () => {
    loggedUser = '1';

    const limit = 20;
    const lastId = 'last id';

    mockHistory(limit, lastId);

    const res = await client.mutate(QUERY, { variables: { limit, lastId } });

    expect(res.errors).toBeFalsy();
    expect(res.data.searchSessionHistory).toEqual(mockResponse.sessions);
  });
});
