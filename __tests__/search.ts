import {
  disposeGraphQLTesting,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testMutationErrorCode,
  testQueryErrorCode,
} from './helpers';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import nock from 'nock';
import { GraphQLTestClient } from './helpers';
import { magniOrigin, SearchResultFeedback } from '../src/integrations';
import { feedFields } from './helpers';
import { meiliIndex, meiliOrigin } from '../src/integrations/meilisearch';
import { ArticlePost, Keyword, Source, User, UserPost } from '../src/entity';
import { postsFixture } from './fixture/post';
import { sourcesFixture } from './fixture/source';
import { usersFixture } from './fixture/user';

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
        createdAt: new Date(2023, 7, 11).toISOString(),
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
    query SearchSessionHistory($after: String, $first: Int) {
      searchSessionHistory(after: $after, first: $first) {
        pageInfo {
          endCursor
          hasNextPage
          hasPreviousPage
        }
        edges {
          node {
            id
            prompt
            createdAt
          }
        }
      }
    }
  `;

  it('should not authorize when not logged in', async () =>
    testQueryErrorCode(client, { query: QUERY }, 'UNAUTHENTICATED'));

  it('should get user search history with limit', async () => {
    loggedUser = '1';

    const limit = 20;

    mockHistory(limit);

    const res = await client.query(QUERY, { variables: { first: limit } });

    expect(res.errors).toBeFalsy();
    expect(res.data).toEqual({
      searchSessionHistory: {
        edges: [
          {
            node: {
              createdAt: expect.any(String),
              id: 'unique id',
              prompt: 'the first question',
            },
          },
        ],
        pageInfo: {
          endCursor: 'unique id',
          hasNextPage: false,
          hasPreviousPage: false,
        },
      },
    });
  });

  it('should get user search history with limit and last id', async () => {
    loggedUser = '1';

    const limit = 20;
    const lastId = 'last id';

    mockHistory(limit, lastId);

    const res = await client.query(QUERY, {
      variables: { first: limit, after: lastId },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.searchSessionHistory).toEqual({
      edges: [
        {
          node: {
            createdAt: expect.any(String),
            id: 'unique id',
            prompt: 'the first question',
          },
        },
      ],
      pageInfo: {
        endCursor: 'unique id',
        hasNextPage: false,
        hasPreviousPage: true,
      },
    });
  });
});

describe('searchSession query', () => {
  const mockResponse = {
    id: 'session id',
    createdAt: new Date(2023, 7, 14).toISOString(),
    chunks: [
      {
        id: 'chunk id',
        prompt: 'user prompt',
        response: 'response as markdown',
        error: {
          code: 'error code (string)',
          message: 'error message',
        },
        createdAt: new Date(2023, 7, 14).toISOString(),
        completedAt: new Date(2023, 7, 14).toISOString(),
        feedback: 1,
        sources: [
          {
            id: 'source id',
            name: 'title returned from the search engine',
            snippet: 'text snippet returned from the search engine',
            url: 'URL to the page itself (external link)',
          },
        ],
      },
    ],
  };

  const mockSession = (id: string) => {
    nock(magniOrigin)
      .get(`/session?id=${id}`)
      .matchHeader('X-User-Id', loggedUser)
      .reply(200, mockResponse);
  };

  const QUERY = `
    query SearchSession($id: String!) {
      searchSession(id: $id) {
        id
        createdAt
        chunks {
          id
          prompt
          response
          error {
            message
            code
          }
          createdAt
          completedAt
          feedback
          sources  {
            id
            name
            snippet
            url
          }
        }
      }
    }
  `;

  it('should not authorize when not logged in', async () =>
    testQueryErrorCode(
      client,
      { query: QUERY, variables: { id: 'session id' } },
      'UNAUTHENTICATED',
    ));

  it('should throw an error when id is missing', async () =>
    testQueryErrorCode(client, { query: QUERY }, 'GRAPHQL_VALIDATION_FAILED'));

  it('should get user search session with id', async () => {
    loggedUser = '1';
    const id = 'session id';

    mockSession(id);

    const res = await client.mutate(QUERY, { variables: { id } });

    expect(res.errors).toBeFalsy();
    expect(res.data.searchSession).toEqual(mockResponse);
  });
});

describe('query searchPostSuggestions', () => {
  const QUERY = (query: string): string => `{
    searchPostSuggestions(query: "${query}") {
      query
      hits {
        title
      }
    }
  }
`;

  it('should return search suggestions', async () => {
    const res = await client.query(QUERY('p1'));
    expect(res.data).toMatchSnapshot();
  });
});

describe('query searchPostSuggestions v2', () => {
  const QUERY = (query: string): string => `{
    searchPostSuggestions(query: "${query}", version: 2) {
      query
      hits {
        title
      }
    }
  }
`;

  const mockMeili = (params: string, res: string) => {
    nock(meiliOrigin)
      .get(`/indexes/${meiliIndex}/search?${params}`)
      .matchHeader('Authorization', `Bearer ${process.env.MEILI_TOKEN}`)
      .reply(204, res);
  };

  beforeEach(async () => {
    await saveFixtures(con, Source, sourcesFixture);
    await saveFixtures(con, ArticlePost, postsFixture);
    mockMeili(
      'q=p1&attributesToRetrieve=post_id,title',
      JSON.stringify({
        hits: [
          { post_id: 'p2', title: 'P2' },
          { post_id: 'p1', title: 'P1' },
        ],
      }),
    );
  });

  it('should return search suggestions', async () => {
    const res = await client.query(QUERY('p1'));
    expect(res.data).toEqual({
      searchPostSuggestions: {
        query: 'p1',
        hits: [{ title: 'P2' }, { title: 'P1' }],
      },
    });
  });

  it('should not return search suggestions if user has hidden posts', async () => {
    loggedUser = '1';
    await con.getRepository(User).save(usersFixture[0]);
    await con.getRepository(UserPost).save({
      userId: '1',
      postId: 'p1',
      hidden: true,
    });
    const res = await client.query(QUERY('p1'));
    expect(res.data).toEqual({
      searchPostSuggestions: {
        query: 'p1',
        hits: [{ title: 'P2' }],
      },
    });
  });

  it('should not return search suggestion if private source', async () => {
    await con.getRepository(Source).update({ id: 'a' }, { private: true });
    const res = await client.query(QUERY('p1'));
    expect(res.data).toEqual({
      searchPostSuggestions: {
        query: 'p1',
        hits: [{ title: 'P2' }],
      },
    });
  });
});

describe('query searchPosts', () => {
  const QUERY = (query: string, now = new Date(), first = 10): string => `{
    searchPosts(query: "${query}", now: "${now.toISOString()}", first: ${first}) {
      query
      ${feedFields()}
    }
  }
`;

  it('should return search feed', async () => {
    const res = await client.query(QUERY('p1'));
    expect(res.data).toMatchSnapshot();
  });

  it('should return search empty feed', async () => {
    const res = await client.query(QUERY('not found'));
    expect(res.data).toMatchSnapshot();
  });
});

describe('query searchTagSuggestions', () => {
  const QUERY = (query: string): string => `{
    searchTagSuggestions(query: "${query}") {
      query
      hits {
        id
        title
      }
    }
  }
`;

  beforeEach(async () => {
    await con.getRepository(Keyword).save([
      {
        value: 'javascript',
        status: 'allow',
        flags: { title: 'JavaScript' },
        occurrences: 20,
      },
      {
        value: 'java',
        status: 'allow',
        flags: { title: 'Java', occurrences: 50 },
      },
      { value: 'javafilms', status: 'deny', occurrences: 0 },
      { value: 'php', status: 'allow', occurrences: 5 },
      { value: 'go', status: 'allow', occurrences: 10 },
    ]);
  });

  it('should return search suggestions', async () => {
    const res = await client.query(QUERY('java'));
    expect(res.errors).toBeFalsy();
    expect(res.data.searchTagSuggestions).toBeTruthy();

    const result = res.data.searchTagSuggestions;

    expect(result.query).toBe('java');
    expect(result.hits).toHaveLength(2);
    expect(result.hits).toMatchObject([
      { id: 'javascript', title: 'JavaScript' },
      { id: 'java', title: 'Java' },
    ]);
  });

  it('should return keyword value as title if no title', async () => {
    const res = await client.query(QUERY('php'));
    expect(res.errors).toBeFalsy();
    expect(res.data.searchTagSuggestions).toBeTruthy();

    const result = res.data.searchTagSuggestions;

    expect(result.query).toBe('php');
    expect(result.hits).toHaveLength(1);
    expect(result.hits).toMatchObject([{ id: 'php', title: 'php' }]);
  });

  it('should only return allowed keywords', async () => {
    const res = await client.query(QUERY('javafilms'));
    expect(res.errors).toBeFalsy();
    expect(res.data.searchTagSuggestions).toBeTruthy();

    const result = res.data.searchTagSuggestions;

    expect(result.query).toBe('javafilms');
    expect(result.hits).toHaveLength(0);
  });
});
