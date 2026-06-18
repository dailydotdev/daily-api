import { DataSource } from 'typeorm';
import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testQueryErrorCode,
} from './helpers';
import createOrGetConnection from '../src/db';
import { ArticlePost } from '../src/entity/posts/ArticlePost';
import { ChannelDigest } from '../src/entity/ChannelDigest';
import { ChannelHighlightDefinition } from '../src/entity/ChannelHighlightDefinition';
import { HighlightsCanonical } from '../src/entity/HighlightsCanonical';
import { Source, SourceType } from '../src/entity/Source';
import { HighlightSignificance } from '../src/common/channelHighlight/significance';
import { PostType } from '../src/entity/posts/Post';
import { sourcesFixture } from './fixture/source';
import { User } from '../src/entity/user/User';
import { usersFixture } from './fixture/user';
import { NotificationPreferenceSource } from '../src/entity/notifications/NotificationPreferenceSource';
import {
  NotificationPreferenceStatus,
  NotificationType,
} from '../src/notifications/common';

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

const createTestPosts = async () => {
  await saveFixtures(con, Source, sourcesFixture);
  await con.getRepository(ArticlePost).save([
    {
      id: 'h1',
      shortId: 'h1',
      title: 'Test Post 1',
      url: 'https://example.com/1',
      score: 0,
      sourceId: 'a',
      visible: true,
      createdAt: new Date('2026-03-19T09:00:00.000Z'),
      type: PostType.Article,
      metadataChangedAt: new Date('2026-03-19T09:00:00.000Z'),
    },
    {
      id: 'h2',
      shortId: 'h2',
      title: 'Test Post 2',
      url: 'https://example.com/2',
      score: 0,
      sourceId: 'a',
      visible: true,
      createdAt: new Date('2026-03-19T10:00:00.000Z'),
      type: PostType.Article,
      metadataChangedAt: new Date('2026-03-19T10:00:00.000Z'),
    },
    {
      id: 'h3',
      shortId: 'h3',
      title: 'Test Post 3',
      url: 'https://example.com/3',
      score: 0,
      sourceId: 'a',
      visible: true,
      createdAt: new Date('2026-03-19T11:00:00.000Z'),
      type: PostType.Article,
      metadataChangedAt: new Date('2026-03-19T11:00:00.000Z'),
    },
    {
      id: 'h4',
      shortId: 'h4',
      title: 'Test Post 4',
      url: 'https://example.com/4',
      score: 0,
      sourceId: 'a',
      visible: true,
      createdAt: new Date('2026-03-19T12:00:00.000Z'),
      type: PostType.Article,
      metadataChangedAt: new Date('2026-03-19T12:00:00.000Z'),
    },
  ]);
};

beforeEach(async () => {
  jest.resetAllMocks();
  loggedUser = null;
  await con.getRepository(NotificationPreferenceSource).clear();
  await con.getRepository(ChannelDigest).clear();
  await con.getRepository(ChannelHighlightDefinition).clear();
  await con.getRepository(HighlightsCanonical).clear();
  await con.getRepository(ArticlePost).delete(['h1', 'h2', 'h3', 'h4']);
  await con
    .getRepository(Source)
    .delete([
      'a',
      'b',
      'c',
      'backend_digest',
      'backend_digest_a',
      'backend_digest_b',
      'career_digest',
    ]);
});

const saveCanonicalHighlights = (
  highlights: Array<
    Partial<HighlightsCanonical> & {
      channel?: string;
    }
  >,
): Promise<HighlightsCanonical[]> =>
  con.getRepository(HighlightsCanonical).save(
    highlights.map(({ channel, channels, ...highlight }) => ({
      ...highlight,
      channels: channels ?? (channel ? [channel] : []),
    })),
  );

const QUERY = `
  query PostHighlights($channel: String!) {
    postHighlights(channel: $channel) {
      id
      channel
      highlightedAt
      headline
      post {
        id
        title
      }
    }
  }
`;

const MAJOR_HEADLINES_QUERY = `
  query MajorHeadlines($first: Int, $after: String) {
    majorHeadlines(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        cursor
        node {
          id
          channel
          highlightedAt
          headline
          significance
          post {
            id
            title
          }
        }
      }
    }
  }
`;

const POST_HIGHLIGHTS_FEED_QUERY = `
  query PostHighlightsFeed(
    $channel: String
    $significance: [String!]
    $first: Int
    $after: String
  ) {
    postHighlightsFeed(
      channel: $channel
      significance: $significance
      first: $first
      after: $after
    ) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        cursor
        node {
          id
          channel
          highlightedAt
          headline
          significance
          post {
            id
            title
          }
        }
      }
    }
  }
`;

const CHANNEL_CONFIGURATIONS_QUERY = `
  query ChannelConfigurations {
    channelConfigurations {
      channel
      displayName
      digest {
        frequency
        source {
          id
          name
          handle
        }
      }
    }
  }
`;

describe('query channelConfigurations', () => {
  it('should return non-disabled highlight channels with digest metadata', async () => {
    await con.getRepository(Source).save({
      id: 'backend_digest',
      name: 'Backend Digest',
      image: 'https://example.com/backend.png',
      handle: 'backend_digest',
      type: SourceType.Machine,
      active: true,
      private: false,
    });

    await con.getRepository(ChannelHighlightDefinition).save([
      {
        channel: 'career',
        displayName: 'Career Growth',
        mode: 'shadow',
        order: 1,
      },
      {
        channel: 'backend',
        displayName: 'Backend Engineering',
        mode: 'publish',
        order: 2,
      },
      {
        channel: 'disabled',
        displayName: 'Disabled',
        mode: 'disabled',
        order: 0,
      },
    ]);

    await con.getRepository(ChannelDigest).save({
      key: 'backend-digest',
      channel: 'backend',
      sourceId: 'backend_digest',
      targetAudience: 'backend developers',
      frequency: 'daily',
      enabled: true,
    });

    const res = await client.query(CHANNEL_CONFIGURATIONS_QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.channelConfigurations).toEqual([
      {
        channel: 'career',
        displayName: 'Career Growth',
        digest: null,
      },
      {
        channel: 'backend',
        displayName: 'Backend Engineering',
        digest: {
          frequency: 'daily',
          source: {
            id: 'backend_digest',
            name: 'Backend Digest',
            handle: 'backend_digest',
          },
        },
      },
    ]);
  });
});

const CHANNEL_DIGEST_CONFIGURATIONS_QUERY = `
  query ChannelDigestConfigurations {
    channelDigestConfigurations {
      frequency
      source {
        id
        name
        handle
      }
    }
  }
`;

const DAILY_HIGHLIGHTS_QUERY = `
  query DailyHighlights($first: Int, $after: String) {
    dailyHighlights(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        cursor
        node {
          id
          channel
          highlightedAt
          headline
          significance
          post {
            id
            title
          }
        }
      }
    }
  }
`;

describe('query dailyHighlights', () => {
  const saveDigestSource = (id: string) =>
    con.getRepository(Source).save({
      id,
      name: id,
      image: `https://example.com/${id}.png`,
      handle: id,
      type: SourceType.Machine,
      active: true,
      private: false,
    });

  const subscribeToDigest = (sourceId: string) =>
    con.getRepository(NotificationPreferenceSource).save({
      userId: '1',
      referenceId: sourceId,
      sourceId,
      notificationType: NotificationType.SourcePostAdded,
      status: NotificationPreferenceStatus.Subscribed,
    });

  beforeEach(async () => {
    await saveFixtures(con, User, usersFixture);
    await createTestPosts();
  });

  it('should require authentication', () =>
    testQueryErrorCode(
      client,
      { query: DAILY_HIGHLIGHTS_QUERY },
      'UNAUTHENTICATED',
    ));

  it('should return the top highlight of the day per subscribed channel', async () => {
    loggedUser = '1';

    await saveDigestSource('backend_digest');
    await saveDigestSource('career_digest');
    await con.getRepository(ChannelDigest).save([
      {
        key: 'backend',
        sourceId: 'backend_digest',
        channel: 'backend',
        targetAudience: 'backend devs',
        frequency: 'daily',
        enabled: true,
      },
      {
        key: 'career',
        sourceId: 'career_digest',
        channel: 'career',
        targetAudience: 'everyone',
        frequency: 'daily',
        enabled: true,
      },
    ]);
    await subscribeToDigest('backend_digest');
    await subscribeToDigest('career_digest');

    const today = new Date();
    today.setUTCHours(12, 0, 0, 0);
    const earlierToday = new Date(today.getTime() - 60 * 60 * 1000);
    const yesterday = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);

    await saveCanonicalHighlights([
      {
        id: '11111111-1111-1111-1111-111111111111',
        postId: 'h1',
        channel: 'backend',
        highlightedAt: today,
        headline: 'Backend major',
        significance: HighlightSignificance.Major,
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        postId: 'h2',
        channel: 'backend',
        highlightedAt: earlierToday,
        headline: 'Backend breaking',
        significance: HighlightSignificance.Breaking,
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        postId: 'h3',
        channel: 'career',
        highlightedAt: today,
        headline: 'Career notable',
        significance: HighlightSignificance.Notable,
      },
      {
        id: '44444444-4444-4444-4444-444444444444',
        postId: 'h4',
        channel: 'backend',
        highlightedAt: yesterday,
        headline: 'Backend stale breaking',
        significance: HighlightSignificance.Breaking,
      },
    ]);

    const res = await client.query(DAILY_HIGHLIGHTS_QUERY);

    expect(res.errors).toBeFalsy();
    // backend → breaking (beats today's major); career → notable; stale excluded.
    // ordered by highlightedAt desc: career @12:00 then backend @11:00.
    expect(
      res.data.dailyHighlights.edges.map(({ node }) => ({
        channel: node.channel,
        headline: node.headline,
        postId: node.post.id,
      })),
    ).toEqual([
      { channel: 'career', headline: 'Career notable', postId: 'h3' },
      { channel: 'backend', headline: 'Backend breaking', postId: 'h2' },
    ]);
  });

  it('should return empty when the user has no subscriptions', async () => {
    loggedUser = '1';

    await saveDigestSource('backend_digest');
    await con.getRepository(ChannelDigest).save({
      key: 'backend',
      sourceId: 'backend_digest',
      channel: 'backend',
      targetAudience: 'backend devs',
      frequency: 'daily',
      enabled: true,
    });
    await saveCanonicalHighlights([
      {
        id: '55555555-5555-5555-5555-555555555555',
        postId: 'h1',
        channel: 'backend',
        highlightedAt: new Date(),
        headline: 'Backend today',
        significance: HighlightSignificance.Major,
      },
    ]);

    const res = await client.query(DAILY_HIGHLIGHTS_QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.dailyHighlights.edges).toEqual([]);
  });
});

describe('query channelDigestConfigurations', () => {
  const saveDigestSource = (id: string, name: string) =>
    con.getRepository(Source).save({
      id,
      name,
      image: `https://example.com/${id}.png`,
      handle: id,
      type: SourceType.Machine,
      active: true,
      private: false,
    });

  it('should return empty array when no digests exist', async () => {
    const res = await client.query(CHANNEL_DIGEST_CONFIGURATIONS_QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.channelDigestConfigurations).toEqual([]);
  });

  it('should return enabled digests ordered by channel and key with source resolved, excluding disabled', async () => {
    await saveDigestSource('backend_digest_a', 'Backend Digest A');
    await saveDigestSource('backend_digest_b', 'Backend Digest B');
    await saveDigestSource('career_digest', 'Career Digest');

    await con.getRepository(ChannelDigest).save([
      {
        key: 'career-digest',
        channel: 'career',
        sourceId: 'career_digest',
        targetAudience: 'career changers',
        frequency: 'weekly',
        enabled: true,
      },
      {
        key: 'backend-b',
        channel: 'backend',
        sourceId: 'backend_digest_b',
        targetAudience: 'backend developers',
        frequency: 'daily',
        enabled: true,
      },
      {
        key: 'backend-a',
        channel: 'backend',
        sourceId: 'backend_digest_a',
        targetAudience: 'backend developers',
        frequency: 'daily',
        enabled: true,
      },
      {
        key: 'backend-disabled',
        channel: 'backend',
        sourceId: 'backend_digest_disabled',
        targetAudience: 'backend developers',
        frequency: 'daily',
        enabled: false,
      },
    ]);

    const res = await client.query(CHANNEL_DIGEST_CONFIGURATIONS_QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.channelDigestConfigurations).toEqual([
      {
        frequency: 'daily',
        source: {
          id: 'backend_digest_a',
          name: 'Backend Digest A',
          handle: 'backend_digest_a',
        },
      },
      {
        frequency: 'daily',
        source: {
          id: 'backend_digest_b',
          name: 'Backend Digest B',
          handle: 'backend_digest_b',
        },
      },
      {
        frequency: 'weekly',
        source: {
          id: 'career_digest',
          name: 'Career Digest',
          handle: 'career_digest',
        },
      },
    ]);
  });
});

describe('query postHighlights', () => {
  it('should return empty array when no highlights exist', async () => {
    const res = await client.query(QUERY, {
      variables: { channel: 'happening-now' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.postHighlights).toEqual([]);
  });

  it('should return highlights ordered by highlightedAt desc', async () => {
    await createTestPosts();
    await saveCanonicalHighlights([
      {
        postId: 'h2',
        channel: 'happening-now',
        highlightedAt: new Date('2026-03-19T10:10:00.000Z'),
        headline: 'Second headline',
      },
      {
        postId: 'h1',
        channel: 'happening-now',
        highlightedAt: new Date('2026-03-19T10:20:00.000Z'),
        headline: 'First headline',
      },
      {
        postId: 'h3',
        channel: 'happening-now',
        highlightedAt: new Date('2026-03-19T10:00:00.000Z'),
        headline: 'Third headline',
      },
    ]);

    const res = await client.query(QUERY, {
      variables: { channel: 'happening-now' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.postHighlights).toHaveLength(3);
    expect(res.data.postHighlights[0]).toMatchObject({
      channel: 'happening-now',
      headline: 'First headline',
      post: { id: 'h1', title: 'Test Post 1' },
    });
    expect(res.data.postHighlights[1]).toMatchObject({
      headline: 'Second headline',
      post: { id: 'h2' },
    });
    expect(res.data.postHighlights[2]).toMatchObject({
      headline: 'Third headline',
      post: { id: 'h3' },
    });
  });

  it('should filter by channel', async () => {
    await createTestPosts();
    await saveCanonicalHighlights([
      {
        postId: 'h1',
        channel: 'happening-now',
        highlightedAt: new Date('2026-03-19T10:00:00.000Z'),
        headline: 'Happening now',
      },
      {
        postId: 'h2',
        channel: 'agentic',
        highlightedAt: new Date('2026-03-19T10:05:00.000Z'),
        headline: 'Agentic highlight',
      },
    ]);

    const res = await client.query(QUERY, {
      variables: { channel: 'agentic' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.postHighlights).toHaveLength(1);
    expect(res.data.postHighlights[0]).toMatchObject({
      channel: 'agentic',
      headline: 'Agentic highlight',
      post: { id: 'h2' },
    });
  });
});

describe('query majorHeadlines', () => {
  it('should return only breaking and major headlines ordered by highlightedAt desc', async () => {
    await createTestPosts();
    await saveCanonicalHighlights([
      {
        postId: 'h1',
        channels: ['vibes', 'agentic'],
        highlightedAt: new Date('2026-03-19T10:40:00.000Z'),
        headline: 'Newer breaking headline',
        significance: HighlightSignificance.Breaking,
      },
      {
        postId: 'h2',
        channel: 'vibes',
        highlightedAt: new Date('2026-03-19T10:35:00.000Z'),
        headline: 'Breaking headline',
        significance: HighlightSignificance.Breaking,
      },
      {
        postId: 'h3',
        channel: 'vibes',
        highlightedAt: new Date('2026-03-19T10:20:00.000Z'),
        headline: 'Routine headline',
        significance: HighlightSignificance.Routine,
      },
      {
        postId: 'h4',
        channel: 'agentic',
        highlightedAt: new Date('2026-03-19T10:10:00.000Z'),
        headline: 'Major headline',
        significance: HighlightSignificance.Major,
      },
    ]);

    const res = await client.query(MAJOR_HEADLINES_QUERY, {
      variables: { first: 10 },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.majorHeadlines.pageInfo.hasNextPage).toBe(false);
    expect(res.data.majorHeadlines.edges).toHaveLength(3);
    expect(res.data.majorHeadlines.edges.map(({ node }) => node)).toEqual([
      expect.objectContaining({
        channel: 'vibes',
        headline: 'Newer breaking headline',
        significance: 'breaking',
        post: { id: 'h1', title: 'Test Post 1' },
      }),
      expect.objectContaining({
        channel: 'vibes',
        headline: 'Breaking headline',
        significance: 'breaking',
        post: { id: 'h2', title: 'Test Post 2' },
      }),
      expect.objectContaining({
        channel: 'agentic',
        headline: 'Major headline',
        significance: 'major',
        post: { id: 'h4', title: 'Test Post 4' },
      }),
    ]);
  });

  it('should paginate major headlines ordered by highlightedAt desc', async () => {
    await createTestPosts();
    await saveCanonicalHighlights([
      {
        postId: 'h1',
        channel: 'vibes',
        highlightedAt: new Date('2026-03-19T10:40:00.000Z'),
        headline: 'Headline 1',
        significance: HighlightSignificance.Breaking,
      },
      {
        postId: 'h2',
        channel: 'agentic',
        highlightedAt: new Date('2026-03-19T10:35:00.000Z'),
        headline: 'Headline 2',
        significance: HighlightSignificance.Major,
      },
      {
        postId: 'h3',
        channel: 'vibes',
        highlightedAt: new Date('2026-03-19T10:25:00.000Z'),
        headline: 'Headline 3',
        significance: HighlightSignificance.Breaking,
      },
    ]);

    const firstPage = await client.query(MAJOR_HEADLINES_QUERY, {
      variables: { first: 2 },
    });

    expect(firstPage.errors).toBeFalsy();
    expect(firstPage.data.majorHeadlines.pageInfo.hasNextPage).toBe(true);
    expect(
      firstPage.data.majorHeadlines.edges.map(({ node }) => node.post.id),
    ).toEqual(['h1', 'h2']);

    const secondPage = await client.query(MAJOR_HEADLINES_QUERY, {
      variables: {
        first: 2,
        after: firstPage.data.majorHeadlines.pageInfo.endCursor,
      },
    });

    expect(secondPage.errors).toBeFalsy();
    expect(secondPage.data.majorHeadlines.pageInfo.hasNextPage).toBe(false);
    expect(
      secondPage.data.majorHeadlines.edges.map(({ node }) => node.post.id),
    ).toEqual(['h3']);
  });
});

describe('query postHighlightsFeed', () => {
  it('should return all highlights ordered desc when no filters are provided', async () => {
    await createTestPosts();
    await saveCanonicalHighlights([
      {
        postId: 'h1',
        channels: ['vibes', 'agentic'],
        highlightedAt: new Date('2026-03-19T10:40:00.000Z'),
        headline: 'Newer vibes',
        significance: HighlightSignificance.Breaking,
      },
      {
        postId: 'h2',
        channel: 'vibes',
        highlightedAt: new Date('2026-03-19T10:35:00.000Z'),
        headline: 'Notable headline',
        significance: HighlightSignificance.Notable,
      },
      {
        postId: 'h3',
        channel: 'agentic',
        highlightedAt: new Date('2026-03-19T10:20:00.000Z'),
        headline: 'Routine headline',
        significance: HighlightSignificance.Routine,
      },
    ]);

    const res = await client.query(POST_HIGHLIGHTS_FEED_QUERY, {
      variables: { first: 10 },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.postHighlightsFeed.pageInfo.hasNextPage).toBe(false);
    expect(res.data.postHighlightsFeed.edges.map(({ node }) => node)).toEqual([
      expect.objectContaining({
        channel: 'vibes',
        headline: 'Newer vibes',
        significance: 'breaking',
        post: { id: 'h1', title: 'Test Post 1' },
      }),
      expect.objectContaining({
        channel: 'vibes',
        headline: 'Notable headline',
        significance: 'notable',
        post: { id: 'h2', title: 'Test Post 2' },
      }),
      expect.objectContaining({
        channel: 'agentic',
        headline: 'Routine headline',
        significance: 'routine',
        post: { id: 'h3', title: 'Test Post 3' },
      }),
    ]);
  });

  it('should filter by channel', async () => {
    await createTestPosts();
    await saveCanonicalHighlights([
      {
        postId: 'h1',
        channel: 'vibes',
        highlightedAt: new Date('2026-03-19T10:40:00.000Z'),
        headline: 'Vibes headline',
        significance: HighlightSignificance.Breaking,
      },
      {
        postId: 'h2',
        channel: 'agentic',
        highlightedAt: new Date('2026-03-19T10:35:00.000Z'),
        headline: 'Agentic headline',
        significance: HighlightSignificance.Major,
      },
      {
        postId: 'h3',
        channel: 'agentic',
        highlightedAt: new Date('2026-03-19T10:30:00.000Z'),
        headline: 'Another agentic headline',
        significance: HighlightSignificance.Notable,
      },
    ]);

    const res = await client.query(POST_HIGHLIGHTS_FEED_QUERY, {
      variables: { channel: 'agentic', first: 10 },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.postHighlightsFeed.edges).toHaveLength(2);
    expect(
      res.data.postHighlightsFeed.edges.map(({ node }) => node.post.id),
    ).toEqual(['h2', 'h3']);
  });

  it('should filter by significance', async () => {
    await createTestPosts();
    await saveCanonicalHighlights([
      {
        postId: 'h1',
        channel: 'vibes',
        highlightedAt: new Date('2026-03-19T10:40:00.000Z'),
        headline: 'Breaking headline',
        significance: HighlightSignificance.Breaking,
      },
      {
        postId: 'h2',
        channel: 'agentic',
        highlightedAt: new Date('2026-03-19T10:35:00.000Z'),
        headline: 'Major headline',
        significance: HighlightSignificance.Major,
      },
      {
        postId: 'h3',
        channel: 'agentic',
        highlightedAt: new Date('2026-03-19T10:30:00.000Z'),
        headline: 'Notable headline',
        significance: HighlightSignificance.Notable,
      },
      {
        postId: 'h4',
        channel: 'agentic',
        highlightedAt: new Date('2026-03-19T10:25:00.000Z'),
        headline: 'Routine headline',
        significance: HighlightSignificance.Routine,
      },
    ]);

    const res = await client.query(POST_HIGHLIGHTS_FEED_QUERY, {
      variables: { significance: ['breaking', 'major'], first: 10 },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.postHighlightsFeed.edges).toHaveLength(2);
    expect(
      res.data.postHighlightsFeed.edges.map(({ node }) => node.post.id),
    ).toEqual(['h1', 'h2']);
  });

  it('should combine channel and significance filters', async () => {
    await createTestPosts();
    await saveCanonicalHighlights([
      {
        postId: 'h1',
        channel: 'vibes',
        highlightedAt: new Date('2026-03-19T10:40:00.000Z'),
        headline: 'Vibes breaking',
        significance: HighlightSignificance.Breaking,
      },
      {
        postId: 'h2',
        channel: 'agentic',
        highlightedAt: new Date('2026-03-19T10:35:00.000Z'),
        headline: 'Agentic breaking',
        significance: HighlightSignificance.Breaking,
      },
      {
        postId: 'h3',
        channel: 'agentic',
        highlightedAt: new Date('2026-03-19T10:30:00.000Z'),
        headline: 'Agentic notable',
        significance: HighlightSignificance.Notable,
      },
    ]);

    const res = await client.query(POST_HIGHLIGHTS_FEED_QUERY, {
      variables: {
        channel: 'agentic',
        significance: ['breaking'],
        first: 10,
      },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.postHighlightsFeed.edges).toHaveLength(1);
    expect(res.data.postHighlightsFeed.edges[0].node).toMatchObject({
      channel: 'agentic',
      headline: 'Agentic breaking',
      post: { id: 'h2' },
    });
  });

  it('should ignore unknown significance values', async () => {
    await createTestPosts();
    await saveCanonicalHighlights([
      {
        postId: 'h1',
        channel: 'vibes',
        highlightedAt: new Date('2026-03-19T10:40:00.000Z'),
        headline: 'Breaking headline',
        significance: HighlightSignificance.Breaking,
      },
      {
        postId: 'h2',
        channel: 'agentic',
        highlightedAt: new Date('2026-03-19T10:35:00.000Z'),
        headline: 'Routine headline',
        significance: HighlightSignificance.Routine,
      },
    ]);

    const res = await client.query(POST_HIGHLIGHTS_FEED_QUERY, {
      variables: { significance: ['nonsense'], first: 10 },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.postHighlightsFeed.edges).toHaveLength(2);
  });

  it('should paginate ordered by highlightedAt desc', async () => {
    await createTestPosts();
    await saveCanonicalHighlights([
      {
        postId: 'h1',
        channel: 'vibes',
        highlightedAt: new Date('2026-03-19T10:40:00.000Z'),
        headline: 'Headline 1',
        significance: HighlightSignificance.Breaking,
      },
      {
        postId: 'h2',
        channel: 'agentic',
        highlightedAt: new Date('2026-03-19T10:35:00.000Z'),
        headline: 'Headline 2',
        significance: HighlightSignificance.Notable,
      },
      {
        postId: 'h3',
        channel: 'vibes',
        highlightedAt: new Date('2026-03-19T10:30:00.000Z'),
        headline: 'Headline 3',
        significance: HighlightSignificance.Routine,
      },
    ]);

    const firstPage = await client.query(POST_HIGHLIGHTS_FEED_QUERY, {
      variables: { first: 2 },
    });

    expect(firstPage.errors).toBeFalsy();
    expect(firstPage.data.postHighlightsFeed.pageInfo.hasNextPage).toBe(true);
    expect(
      firstPage.data.postHighlightsFeed.edges.map(({ node }) => node.post.id),
    ).toEqual(['h1', 'h2']);

    const secondPage = await client.query(POST_HIGHLIGHTS_FEED_QUERY, {
      variables: {
        first: 2,
        after: firstPage.data.postHighlightsFeed.pageInfo.endCursor,
      },
    });

    expect(secondPage.errors).toBeFalsy();
    expect(secondPage.data.postHighlightsFeed.pageInfo.hasNextPage).toBe(false);
    expect(
      secondPage.data.postHighlightsFeed.edges.map(({ node }) => node.post.id),
    ).toEqual(['h3']);
  });
});
