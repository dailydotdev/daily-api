import { DataSource } from 'typeorm';
import { User } from '../src/entity';
import createOrGetConnection from '../src/db';
import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testQueryErrorCode,
} from './helpers';
import { usersFixture } from './fixture/user';
import nock from 'nock';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string = null;

const originalCommentsPrefix = process.env.COMMENTS_PREFIX;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser),
  );
  client = state.client;
});

afterAll(() => {
  disposeGraphQLTesting(state);
  process.env.COMMENTS_PREFIX = originalCommentsPrefix;
});

beforeEach(async () => {
  loggedUser = null;
  process.env.COMMENTS_PREFIX = 'https://app.daily.dev';

  await saveFixtures(con, User, usersFixture);
});

describe('query getShortUrl', () => {
  const QUERY = `
    query GetShortUrl($url: String!) {
      getShortUrl(url: $url)
    }
  `;

  it('should return unauthenticated when not logged in', () =>
    testQueryErrorCode(
      client,
      { query: QUERY, variables: { url: 'https://app.daily.dev/posts/test' } },
      'UNAUTHENTICATED',
    ));

  it('should reject subdomain spoofing attempts', async () => {
    loggedUser = '1';
    const res = await client.query(QUERY, {
      variables: { url: 'https://app.daily.dev.attacker.com/posts/test' },
    });
    expect(res.errors).toBeDefined();
    expect(res.errors?.length).toBeGreaterThan(0);
    expect(res.errors?.[0].message).toEqual('Invalid url');
  });

  it('should reject subdomain spoofing with linkedin domain', async () => {
    loggedUser = '1';
    const res = await client.query(QUERY, {
      variables: { url: 'https://app.daily.dev.linkedin.com/posts/test' },
    });
    expect(res.errors).toBeDefined();
    expect(res.errors?.length).toBeGreaterThan(0);
    expect(res.errors?.[0].message).toEqual('Invalid url');
  });

  it('should reject unrelated domains', async () => {
    loggedUser = '1';
    const res = await client.query(QUERY, {
      variables: { url: 'https://evil.com/posts/test' },
    });
    expect(res.errors).toBeDefined();
    expect(res.errors?.length).toBeGreaterThan(0);
    expect(res.errors?.[0].message).toEqual('Invalid url');
  });

  it('should reject invalid URLs', async () => {
    loggedUser = '1';
    const res = await client.query(QUERY, {
      variables: { url: 'not-a-url' },
    });
    expect(res.errors).toBeDefined();
    expect(res.errors?.length).toBeGreaterThan(0);
    expect(res.errors?.[0].message).toEqual('Invalid url');
  });

  it('should accept valid daily.dev URLs', async () => {
    loggedUser = '1';

    // Mock the URL shortener service since we're not testing that here
    nock(process.env.URL_SHORTENER_BASE_URL || 'http://localhost')
      .post('/shorten')
      .reply(200, { url: 'https://dly.to/test123' });

    const res = await client.query(QUERY, {
      variables: { url: 'https://app.daily.dev/posts/test' },
    });

    // Should not throw validation error
    expect(res.errors?.some((e) => e.message === 'Invalid url')).toBeFalsy();
  });

  it('should accept valid daily.dev URLs with query parameters', async () => {
    loggedUser = '1';

    // Mock the URL shortener service
    nock(process.env.URL_SHORTENER_BASE_URL || 'http://localhost')
      .post('/shorten')
      .reply(200, { url: 'https://dly.to/test456' });

    const res = await client.query(QUERY, {
      variables: {
        url: 'https://app.daily.dev/posts/test?userid=123&cid=share_post',
      },
    });

    // Should not throw validation error
    expect(res.errors?.some((e) => e.message === 'Invalid url')).toBeFalsy();
  });
});
