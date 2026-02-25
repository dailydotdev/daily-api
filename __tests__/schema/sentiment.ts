import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  testQueryErrorCode,
} from '../helpers';
import { deleteKeysByPattern } from '../../src/redis';
import { rateLimiterName } from '../../src/directive/rateLimit';
import { yggdrasilSentimentClient } from '../../src/integrations/yggdrasil/clients';
import { HttpError } from '../../src/integrations/retry';

jest.mock('../../src/integrations/yggdrasil/clients', () => ({
  yggdrasilSentimentClient: {
    getTimeSeries: jest.fn(),
    getHighlights: jest.fn(),
  },
}));

const getTimeSeriesMock =
  yggdrasilSentimentClient.getTimeSeries as jest.MockedFunction<
    typeof yggdrasilSentimentClient.getTimeSeries
  >;
const getHighlightsMock =
  yggdrasilSentimentClient.getHighlights as jest.MockedFunction<
    typeof yggdrasilSentimentClient.getHighlights
  >;

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let trackingId = 'sentiment-test-tracking';

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () =>
      new MockContext(
        con,
        null,
        [],
        undefined,
        undefined,
        undefined,
        undefined,
        trackingId,
      ),
  );
  client = state.client;
});

afterAll(async () => {
  await disposeGraphQLTesting(state);
});

beforeEach(async () => {
  trackingId = 'sentiment-test-tracking';
  jest.clearAllMocks();
  await deleteKeysByPattern(`${rateLimiterName}:*`);
});

describe('query sentimentTimeSeries', () => {
  const QUERY = /* GraphQL */ `
    query SentimentTimeSeries(
      $resolution: SentimentResolution!
      $entity: String
      $groupId: ID
      $lookback: String
    ) {
      sentimentTimeSeries(
        resolution: $resolution
        entity: $entity
        groupId: $groupId
        lookback: $lookback
      ) {
        start
        resolutionSeconds
        entities {
          nodes {
            entity
            timestamps
            scores
            volume
            scoreVariance
          }
        }
      }
    }
  `;

  it('should return transformed time series data for entity queries', async () => {
    getTimeSeriesMock.mockResolvedValue({
      start: 1739815200,
      resolution_seconds: 3600,
      entities: {
        'daily.dev': {
          t: [0, 3600],
          s: [0.5, -0.2],
          v: [4, 3],
          sv: [0.25, 1],
        },
      },
    });

    const res = await client.query(QUERY, {
      variables: {
        resolution: 'HOUR',
        entity: 'daily.dev',
        lookback: '48h',
      },
    });

    expect(res.errors).toBeFalsy();
    expect(getTimeSeriesMock).toHaveBeenCalledWith({
      resolution: '1h',
      entity: 'daily.dev',
      groupId: undefined,
      lookback: '48h',
    });
    expect(res.data).toEqual({
      sentimentTimeSeries: {
        start: 1739815200,
        resolutionSeconds: 3600,
        entities: {
          nodes: [
            {
              entity: 'daily.dev',
              timestamps: [0, 3600],
              scores: [0.5, -0.2],
              volume: [4, 3],
              scoreVariance: [0.25, 1],
            },
          ],
        },
      },
    });
  });

  it('should accept groupId and map 404 to NOT_FOUND', async () => {
    getTimeSeriesMock.mockRejectedValue(
      new HttpError(
        'http://localhost:3002/api/sentiment/timeseries',
        404,
        'not found',
      ),
    );

    await testQueryErrorCode(
      client,
      {
        query: QUERY,
        variables: {
          resolution: 'DAY',
          groupId: 'group-1',
        },
      },
      'NOT_FOUND',
    );
  });

  it('should validate that exactly one filter is provided', async () => {
    await testQueryErrorCode(
      client,
      {
        query: QUERY,
        variables: { resolution: 'HOUR' },
      },
      'GRAPHQL_VALIDATION_FAILED',
      'Exactly one of entity or groupId must be set',
    );

    await testQueryErrorCode(
      client,
      {
        query: QUERY,
        variables: {
          resolution: 'HOUR',
          entity: 'daily.dev',
          groupId: 'group-1',
        },
      },
      'GRAPHQL_VALIDATION_FAILED',
      'Exactly one of entity or groupId must be set',
    );
  });
});

describe('query sentimentHighlights', () => {
  const QUERY = /* GraphQL */ `
    query SentimentHighlights(
      $entity: String
      $groupId: ID
      $first: Int
      $after: String
      $orderBy: SentimentHighlightsOrderBy
    ) {
      sentimentHighlights(
        entity: $entity
        groupId: $groupId
        first: $first
        after: $after
        orderBy: $orderBy
      ) {
        cursor
        items {
          provider
          externalItemId
          url
          text
          createdAt
          author {
            __typename
            ... on SentimentAuthorX {
              id
              name
              handle
              avatarUrl
            }
          }
          metrics {
            __typename
            ... on SentimentMetricsX {
              likeCount
              replyCount
              retweetCount
              quoteCount
              bookmarkCount
              impressionCount
            }
          }
          sentiments {
            entity
            score
            highlightScore
          }
        }
      }
    }
  `;

  it('should transform highlight payload and resolve X union types', async () => {
    getHighlightsMock.mockResolvedValue({
      items: [
        {
          provider: 'x_search',
          external_item_id: '123',
          url: 'https://x.com/status/123',
          text: 'Daily dev mention',
          author: {
            id: 'a1',
            name: 'Alice',
            handle: 'alice',
            avatar_url: 'https://avatar',
          },
          metrics: {
            like_count: 11,
            reply_count: 4,
            retweet_count: 3,
            quote_count: 1,
            bookmark_count: 2,
            impression_count: 150,
          },
          created_at: '2026-02-20T15:00:00.000Z',
          sentiments: [
            {
              entity: 'daily.dev',
              score: 0.7,
              highlight_score: 0.8,
            },
          ],
        },
      ],
      cursor: 'next-cursor',
    });

    const res = await client.query(QUERY, {
      variables: {
        entity: 'daily.dev',
        first: 12,
        after: 'prev-cursor',
      },
    });

    expect(res.errors).toBeFalsy();
    expect(getHighlightsMock).toHaveBeenCalledWith({
      entity: 'daily.dev',
      groupId: undefined,
      limit: 12,
      after: 'prev-cursor',
      orderBy: undefined,
    });
    expect(res.data.sentimentHighlights).toEqual({
      cursor: 'next-cursor',
      items: [
        {
          provider: 'x_search',
          externalItemId: '123',
          url: 'https://x.com/status/123',
          text: 'Daily dev mention',
          createdAt: '2026-02-20T15:00:00.000Z',
          author: {
            __typename: 'SentimentAuthorX',
            id: 'a1',
            name: 'Alice',
            handle: 'alice',
            avatarUrl: 'https://avatar',
          },
          metrics: {
            __typename: 'SentimentMetricsX',
            likeCount: 11,
            replyCount: 4,
            retweetCount: 3,
            quoteCount: 1,
            bookmarkCount: 2,
            impressionCount: 150,
          },
          sentiments: [
            {
              entity: 'daily.dev',
              score: 0.7,
              highlightScore: 0.8,
            },
          ],
        },
      ],
    });
  });

  it('should default first to 20 and fallback unknown providers to X unions', async () => {
    getHighlightsMock.mockResolvedValue({
      items: [
        {
          provider: 'unknown-provider',
          external_item_id: '456',
          url: 'https://example.com/456',
          text: 'Unknown provider payload',
          author: {
            name: 'Unknown Author',
            handle: 'unknown-handle',
            avatar_url: 'https://unknown-author-avatar',
          },
          metrics: {
            like_count: 99,
          },
          created_at: '2026-02-21T15:00:00.000Z',
          sentiments: [],
        },
      ],
      cursor: null,
    });

    const res = await client.query(QUERY, {
      variables: {
        entity: 'daily.dev',
      },
    });

    expect(res.errors).toBeFalsy();
    expect(getHighlightsMock).toHaveBeenCalledWith({
      entity: 'daily.dev',
      groupId: undefined,
      limit: 20,
      after: undefined,
      orderBy: undefined,
    });
    expect(res.data.sentimentHighlights.items[0].author.__typename).toEqual(
      'SentimentAuthorX',
    );
    expect(res.data.sentimentHighlights.items[0].author).toMatchObject({
      name: 'Unknown Author',
      handle: 'unknown-handle',
      avatarUrl: 'https://unknown-author-avatar',
    });
    expect(res.data.sentimentHighlights.items[0].metrics.__typename).toEqual(
      'SentimentMetricsX',
    );
    expect(res.data.sentimentHighlights.items[0].metrics).toMatchObject({
      likeCount: 99,
    });
  });

  it('should validate first range', async () => {
    await testQueryErrorCode(
      client,
      {
        query: QUERY,
        variables: {
          entity: 'daily.dev',
          first: 0,
        },
      },
      'GRAPHQL_VALIDATION_FAILED',
      'first must be between 1 and 50',
    );
  });

  it('should map orderBy enum to yggdrasil orderBy param', async () => {
    getHighlightsMock.mockResolvedValue({
      items: [],
      cursor: null,
    });

    const res = await client.query(QUERY, {
      variables: {
        entity: 'daily.dev',
        first: 10,
        orderBy: 'RECENCY',
      },
    });

    expect(res.errors).toBeFalsy();
    expect(getHighlightsMock).toHaveBeenCalledWith({
      entity: 'daily.dev',
      groupId: undefined,
      limit: 10,
      after: undefined,
      orderBy: 'recency',
    });
  });

  it('should enforce shared 30/min rate limit across sentiment queries', async () => {
    getTimeSeriesMock.mockResolvedValue({
      start: 1739815200,
      resolution_seconds: 3600,
      entities: {},
    });

    getHighlightsMock.mockResolvedValue({
      items: [],
      cursor: null,
    });

    const timeSeriesQuery = /* GraphQL */ `
      query SentimentRateLimitTimeSeries(
        $resolution: SentimentResolution!
        $entity: String
      ) {
        sentimentTimeSeries(resolution: $resolution, entity: $entity) {
          start
        }
      }
    `;

    for (let attempt = 0; attempt < 15; attempt += 1) {
      const ts = await client.query(timeSeriesQuery, {
        variables: { resolution: 'HOUR', entity: 'daily.dev' },
      });
      expect(ts.errors).toBeFalsy();

      const highlights = await client.query(QUERY, {
        variables: { entity: 'daily.dev', first: 1 },
      });
      expect(highlights.errors).toBeFalsy();
    }

    await testQueryErrorCode(
      client,
      {
        query: QUERY,
        variables: { entity: 'daily.dev', first: 1 },
      },
      'RATE_LIMITED',
      'Rate limit exceeded. Try again in 1 minute',
    );
  });
});
