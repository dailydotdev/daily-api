import {
  disposeGraphQLTesting,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  testMutationErrorCode,
} from './helpers';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import nock from 'nock';
import { GraphQLTestClient } from './helpers';
import { SearchResultFeedback } from '../src/integrations';

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
    nock(process.env.MAGNI_ORIGIN)
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
