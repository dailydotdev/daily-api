import nock from 'nock';
import { DataSource } from 'typeorm';
import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
} from './helpers';
import createOrGetConnection from '../src/db';
import { deleteRedisKey, getRedisObject } from '../src/redis';
import { generateStorageKey, StorageKey, StorageTopic } from '../src/config';
import { ArticlePost } from '../src/entity/posts/ArticlePost';
import { HighlightsCanonical } from '../src/entity/HighlightsCanonical';
import { Source } from '../src/entity/Source';
import { HighlightSignificance } from '../src/common/channelHighlight/significance';
import { PostType } from '../src/entity/posts/Post';
import { sourcesFixture } from './fixture/source';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string | null = null;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser),
  );
  client = state.client;
});

afterAll(async () => {
  await disposeGraphQLTesting(state);
});

const cacheKey = generateStorageKey(
  StorageTopic.Feed,
  StorageKey.Statusline,
  'global',
);

beforeEach(async () => {
  loggedUser = null;
  nock.cleanAll();
  await deleteRedisKey(cacheKey);
});

const QUERY = `
  query StatuslineHeadlines($first: Int) {
    statuslineHeadlines(first: $first)
  }
`;

const createTestPosts = async () => {
  await saveFixtures(con, Source, sourcesFixture);
  await con.getRepository(ArticlePost).save(
    ['s1', 's2', 's3', 's4'].map((id, index) => ({
      id,
      shortId: id,
      title: `Statusline Post ${index + 1}`,
      url: `https://example.com/${id}`,
      score: 0,
      sourceId: 'a',
      visible: true,
      upvotes: index * 10,
      createdAt: new Date('2026-03-19T09:00:00.000Z'),
      type: PostType.Article,
      metadataChangedAt: new Date('2026-03-19T09:00:00.000Z'),
    })),
  );
};

const mockFeedService = (ids: string[]) =>
  nock('http://localhost:6000')
    .post('/api/feed')
    .reply(200, { data: ids.map((post_id) => ({ post_id })) });

const stripEscapes = (line: string): string =>
  line
    .replace(/\u001b\]8;;[^\u001b]*\u001b\\/g, '')
    .replace(/\u001b\[[0-9;]*m/g, '');

describe('query statuslineHeadlines', () => {
  it('should interleave rendered headline and popular lines with links', async () => {
    await createTestPosts();
    await con.getRepository(HighlightsCanonical).save([
      {
        postId: 's1',
        channels: ['vibes'],
        highlightedAt: new Date('2026-03-19T10:40:00.000Z'),
        headline: 'Breaking statusline headline',
        significance: HighlightSignificance.Breaking,
      },
      {
        postId: 's2',
        channels: ['vibes'],
        highlightedAt: new Date('2026-03-19T10:20:00.000Z'),
        headline: 'Routine headline should not appear',
        significance: HighlightSignificance.Routine,
      },
    ]);
    mockFeedService(['s3', 's4']);

    const res = await client.query(QUERY);

    expect(res.errors).toBeFalsy();
    const lines = res.data.statuslineHeadlines as string[];
    expect(lines.map(stripEscapes)).toEqual([
      'daily.dev Breaking statusline headline',
      'daily.dev Statusline Post 3 ▲20',
      'daily.dev Statusline Post 4 ▲30',
    ]);
    expect(lines[0]).toContain(
      `${process.env.URL_PREFIX}/c/s1?utm_source=claude-code&utm_medium=statusline`,
    );
    expect(lines[1]).toContain('\u001b]8;;');
    expect(lines[1]).toContain('\u001b[1m');
  });

  it('should dedupe posts appearing in both feeds and respect first', async () => {
    await createTestPosts();
    await con.getRepository(HighlightsCanonical).save([
      {
        postId: 's3',
        channels: ['vibes'],
        highlightedAt: new Date('2026-03-19T10:40:00.000Z'),
        headline: 'Curated take on post three',
        significance: HighlightSignificance.Major,
      },
    ]);
    mockFeedService(['s3', 's4']);

    const res = await client.query(QUERY, { variables: { first: 2 } });

    expect(res.errors).toBeFalsy();
    expect(
      (res.data.statuslineHeadlines as string[]).map(stripEscapes),
    ).toEqual([
      'daily.dev Curated take on post three ▲20',
      'daily.dev Statusline Post 4 ▲30',
    ]);
  });

  it('should degrade to headlines only when the feed service fails', async () => {
    await createTestPosts();
    await con.getRepository(HighlightsCanonical).save([
      {
        postId: 's1',
        channels: ['vibes'],
        highlightedAt: new Date('2026-03-19T10:40:00.000Z'),
        headline: 'Surviving headline',
        significance: HighlightSignificance.Breaking,
      },
    ]);
    nock('http://localhost:6000').post('/api/feed').reply(500);

    const res = await client.query(QUERY);

    expect(res.errors).toBeFalsy();
    expect(
      (res.data.statuslineHeadlines as string[]).map(stripEscapes),
    ).toEqual(['daily.dev Surviving headline']);
  });

  it('should serve from cache without hitting the feed service again', async () => {
    await createTestPosts();
    mockFeedService(['s3']);

    const first = await client.query(QUERY);
    expect(first.errors).toBeFalsy();
    expect(await getRedisObject(cacheKey)).toBeTruthy();

    // no nock registered for a second call — would throw on a network hit
    const second = await client.query(QUERY);
    expect(second.errors).toBeFalsy();
    expect(second.data).toEqual(first.data);
  });
});
