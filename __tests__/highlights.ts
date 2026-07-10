import { DataSource } from 'typeorm';
import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testMutationErrorCode,
  testQueryErrorCode,
} from './helpers';
import createOrGetConnection from '../src/db';
import {
  getRedisObject,
  getRedisObjectExpiry,
  ioRedisPool,
} from '../src/redis';
import { generateStorageKey, StorageKey, StorageTopic } from '../src/config';
import { ArticlePost } from '../src/entity/posts/ArticlePost';
import { FreeformPost } from '../src/entity/posts/FreeformPost';
import { BriefPost } from '../src/entity/posts/BriefPost';
import { ChannelDigest } from '../src/entity/ChannelDigest';
import { ChannelHighlightDefinition } from '../src/entity/ChannelHighlightDefinition';
import { HighlightsCanonical } from '../src/entity/HighlightsCanonical';
import { Source, SourceType } from '../src/entity/Source';
import { HighlightSignificance } from '../src/common/channelHighlight/significance';
import { PostType } from '../src/entity/posts/Post';
import { sourcesFixture } from './fixture/source';
import { User } from '../src/entity/user/User';
import { usersFixture } from './fixture/user';
import { Feed } from '../src/entity/Feed';
import { ContentPreferenceSource } from '../src/entity/contentPreference/ContentPreferenceSource';
import { ContentPreferenceKeyword } from '../src/entity/contentPreference/ContentPreferenceKeyword';
import {
  ContentPreferenceStatus,
  ContentPreferenceType,
} from '../src/entity/contentPreference/types';
import { Keyword } from '../src/entity/Keyword';
import { PostKeyword } from '../src/entity/PostKeyword';
import { UserAction, UserActionType } from '../src/entity/user/UserAction';

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
  await con.getRepository(ContentPreferenceSource).clear();
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

const DAILY_HEADLINES_QUERY = `
  query DailyHeadlines($first: Int, $after: String) {
    dailyHeadlines(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        cursor
        node {
          id
          title
        }
      }
    }
  }
`;

describe('query dailyHeadlines', () => {
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

  const saveChannelDigest = (key: string, sourceId: string, channel: string) =>
    con.getRepository(ChannelDigest).save({
      key,
      sourceId,
      channel,
      targetAudience: 'devs',
      frequency: 'daily',
      enabled: true,
    });

  const saveDigestPost = (
    id: string,
    sourceId: string,
    title: string,
    createdAt: Date,
  ) =>
    con.getRepository(FreeformPost).save({
      id,
      shortId: id,
      sourceId,
      type: PostType.Freeform,
      title,
      content: title,
      contentHtml: `<p>${title}</p>`,
      visible: true,
      visibleAt: createdAt,
      createdAt,
      metadataChangedAt: createdAt,
      showOnFeed: true,
      private: false,
    });

  const followDigest = (
    sourceId: string,
    status: ContentPreferenceStatus = ContentPreferenceStatus.Follow,
  ) =>
    con.getRepository(ContentPreferenceSource).save({
      userId: '1',
      feedId: '1',
      referenceId: sourceId,
      sourceId,
      status,
    });

  const hoursAgo = (hours: number): Date =>
    new Date(Date.now() - hours * 60 * 60 * 1000);

  const saveBriefPost = (
    id: string,
    title: string,
    createdAt: Date,
    authorId = '1',
  ) =>
    con.getRepository(BriefPost).save({
      id,
      shortId: id,
      sourceId: 'briefing',
      authorId,
      type: PostType.Brief,
      title,
      visible: true,
      visibleAt: createdAt,
      createdAt,
      metadataChangedAt: createdAt,
      private: false,
    });

  beforeEach(async () => {
    await saveFixtures(con, User, usersFixture);
    await saveFixtures(con, Feed, [{ id: '1', userId: '1' }]);
  });

  it('should require authentication', () =>
    testQueryErrorCode(
      client,
      { query: DAILY_HEADLINES_QUERY },
      'UNAUTHENTICATED',
    ));

  it('should return the latest digest post per followed channel, including subscribed and excluding blocked', async () => {
    loggedUser = '1';

    await saveDigestSource('backend_digest');
    await saveDigestSource('career_digest');
    await saveDigestSource('backend_digest_b');
    await saveChannelDigest('backend', 'backend_digest', 'backend');
    await saveChannelDigest('career', 'career_digest', 'career');
    await saveChannelDigest('backendb', 'backend_digest_b', 'backendb');
    await followDigest('backend_digest', ContentPreferenceStatus.Follow);
    await followDigest('career_digest', ContentPreferenceStatus.Subscribed);
    await followDigest('backend_digest_b', ContentPreferenceStatus.Blocked);

    await saveDigestPost(
      'bd-old',
      'backend_digest',
      'Backend old',
      hoursAgo(20),
    );
    await saveDigestPost(
      'bd-new',
      'backend_digest',
      'Backend latest',
      hoursAgo(2),
    );
    await saveDigestPost(
      'career-d',
      'career_digest',
      'Career latest',
      hoursAgo(5),
    );
    await saveDigestPost('bdb-d', 'backend_digest_b', 'Blocked', hoursAgo(1));

    const res = await client.query(DAILY_HEADLINES_QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.dailyHeadlines.edges.map(({ node }) => node.id)).toEqual([
      'bd-new',
      'career-d',
    ]);
  });

  it('should return empty when the user follows no digest channels', async () => {
    loggedUser = '1';

    await saveDigestSource('backend_digest');
    await saveChannelDigest('backend', 'backend_digest', 'backend');
    await saveDigestPost('bd-1', 'backend_digest', 'Backend', new Date());

    const res = await client.query(DAILY_HEADLINES_QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.dailyHeadlines.edges).toEqual([]);
  });

  it('should exclude digest posts older than 24 hours', async () => {
    loggedUser = '1';

    await saveDigestSource('backend_digest');
    await saveChannelDigest('backend', 'backend_digest', 'backend');
    await followDigest('backend_digest');
    await saveDigestPost('bd-stale', 'backend_digest', 'Stale', hoursAgo(30));

    const res = await client.query(DAILY_HEADLINES_QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.dailyHeadlines.edges).toEqual([]);
  });

  it('should lead with the latest brief even when a digest post is newer', async () => {
    loggedUser = '1';

    await saveDigestSource('briefing');
    await saveDigestSource('backend_digest');
    await saveChannelDigest('backend', 'backend_digest', 'backend');
    await followDigest('backend_digest');
    await saveDigestPost('bd-new', 'backend_digest', 'Backend', hoursAgo(1));
    await saveBriefPost('brief-old', 'Your briefing', hoursAgo(10));

    const res = await client.query(DAILY_HEADLINES_QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.dailyHeadlines.edges.map(({ node }) => node.id)).toEqual([
      'brief-old',
      'bd-new',
    ]);
  });

  it('should return the brief even when the user follows no channels', async () => {
    loggedUser = '1';

    await saveDigestSource('briefing');
    await saveBriefPost('brief-1', 'Your briefing', hoursAgo(1));

    const res = await client.query(DAILY_HEADLINES_QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.dailyHeadlines.edges.map(({ node }) => node.id)).toEqual([
      'brief-1',
    ]);
  });

  it('should not return briefs authored by other users', async () => {
    loggedUser = '1';

    await saveDigestSource('briefing');
    await saveBriefPost('brief-other', 'Other briefing', hoursAgo(1), '2');

    const res = await client.query(DAILY_HEADLINES_QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.dailyHeadlines.edges).toEqual([]);
  });

  it('should exclude a brief older than 24 hours', async () => {
    loggedUser = '1';

    await saveDigestSource('briefing');
    await saveBriefPost('brief-stale', 'Your briefing', hoursAgo(30));

    const res = await client.query(DAILY_HEADLINES_QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.dailyHeadlines.edges).toEqual([]);
  });

  const DAILY_HEADLINES_BACKFILL_QUERY = `
  query DailyHeadlinesBackfill($first: Int, $after: String) {
    dailyHeadlines(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
        }
      }
    }
  }
`;

  describe('backfill', () => {
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

    const saveChannelDigest = (
      key: string,
      sourceId: string,
      channel: string,
    ) =>
      con.getRepository(ChannelDigest).save({
        key,
        sourceId,
        channel,
        targetAudience: 'devs',
        frequency: 'daily',
        enabled: true,
      });

    const saveDigestPost = (id: string, sourceId: string, createdAt: Date) =>
      con.getRepository(FreeformPost).save({
        id,
        shortId: id,
        sourceId,
        type: PostType.Freeform,
        title: id,
        content: id,
        contentHtml: `<p>${id}</p>`,
        visible: true,
        visibleAt: createdAt,
        createdAt,
        metadataChangedAt: createdAt,
        showOnFeed: true,
        private: false,
      });

    const followKeyword = (value: string) =>
      con.getRepository(ContentPreferenceKeyword).save({
        userId: '1',
        feedId: '1',
        referenceId: value,
        keywordId: value,
        status: ContentPreferenceStatus.Follow,
        type: ContentPreferenceType.Keyword,
      });

    const saveChannelPosts = async (
      prefix: string,
      channels: string[],
      keyword: string,
      count: number,
    ) => {
      for (let i = 0; i < count; i += 1) {
        const id = `${prefix}-${i}`;
        await con.getRepository(ArticlePost).save({
          id,
          shortId: id,
          title: id,
          url: `https://example.com/${id}`,
          sourceId: 'a',
          visible: true,
          private: false,
          deleted: false,
          type: PostType.Article,
          createdAt: new Date(),
          metadataChangedAt: new Date(),
          contentMeta: { channels },
        });
        await con.getRepository(PostKeyword).save({ postId: id, keyword });
      }
    };

    const hoursAgo = (hours: number): Date =>
      new Date(Date.now() - hours * 60 * 60 * 1000);

    const refreshKeywordChannel = () =>
      con.query('REFRESH MATERIALIZED VIEW keyword_channel');

    beforeEach(async () => {
      await con.getRepository(ContentPreferenceKeyword).clear();
      await con.getRepository(PostKeyword).clear();
      await con.getRepository(UserAction).delete({ userId: '1' });
      await saveFixtures(con, User, usersFixture);
      await saveFixtures(con, Feed, [{ id: '1', userId: '1' }]);
      await saveFixtures(con, Source, [
        {
          id: 'a',
          name: 'A',
          image: 'https://example.com/a.png',
          handle: 'a',
          type: SourceType.Machine,
          active: true,
          private: false,
        },
      ]);
      await saveFixtures(con, Keyword, [
        { value: 'nodejs' },
        { value: 'docker' },
      ]);
    });

    it('should require authentication', () =>
      testQueryErrorCode(
        client,
        { query: DAILY_HEADLINES_BACKFILL_QUERY },
        'UNAUTHENTICATED',
      ));

    it('should seed channel digest follows from onboarding tags and return their digest posts', async () => {
      loggedUser = '1';

      await saveDigestSource('backend_digest');
      await saveChannelDigest('backend', 'backend_digest', 'backend');
      await followKeyword('nodejs');
      await saveChannelPosts('mh', ['backend'], 'nodejs', 3);
      await saveDigestPost('bd-new', 'backend_digest', hoursAgo(2));
      await refreshKeywordChannel();

      const res = await client.query(DAILY_HEADLINES_BACKFILL_QUERY);

      expect(res.errors).toBeFalsy();
      const follows = await con
        .getRepository(ContentPreferenceSource)
        .find({ where: { userId: '1', feedId: '1' } });
      expect(follows).toHaveLength(1);
      expect(follows[0]).toMatchObject({
        referenceId: 'backend_digest',
        sourceId: 'backend_digest',
        status: ContentPreferenceStatus.Follow,
      });
      expect(res.data.dailyHeadlines.edges.map(({ node }) => node.id)).toEqual([
        'bd-new',
      ]);
      const action = await con.getRepository(UserAction).findOneBy({
        userId: '1',
        type: UserActionType.DailyHeadlinesBackfilled,
      });
      expect(action).not.toBeNull();
    });

    it('should mark backfilled without seeding when no channel clears the minimum post count', async () => {
      loggedUser = '1';

      await saveDigestSource('backend_digest');
      await saveChannelDigest('backend', 'backend_digest', 'backend');
      await followKeyword('nodejs');
      await saveChannelPosts('mh', ['backend'], 'nodejs', 2);
      await refreshKeywordChannel();

      const res = await client.query(DAILY_HEADLINES_BACKFILL_QUERY);

      expect(res.errors).toBeFalsy();
      const follows = await con
        .getRepository(ContentPreferenceSource)
        .findBy({ userId: '1' });
      expect(follows).toHaveLength(0);
      const action = await con.getRepository(UserAction).findOneBy({
        userId: '1',
        type: UserActionType.DailyHeadlinesBackfilled,
      });
      expect(action).not.toBeNull();
    });

    it('should not seed when the user was already backfilled', async () => {
      loggedUser = '1';

      await saveDigestSource('backend_digest');
      await saveChannelDigest('backend', 'backend_digest', 'backend');
      await followKeyword('nodejs');
      await saveChannelPosts('mh', ['backend'], 'nodejs', 3);
      await con.getRepository(UserAction).save({
        userId: '1',
        type: UserActionType.DailyHeadlinesBackfilled,
      });

      const res = await client.query(DAILY_HEADLINES_BACKFILL_QUERY);

      expect(res.errors).toBeFalsy();
      const follows = await con
        .getRepository(ContentPreferenceSource)
        .findBy({ userId: '1', status: ContentPreferenceStatus.Follow });
      expect(follows).toHaveLength(0);
    });

    it('should not seed when the user already has a channel digest preference', async () => {
      loggedUser = '1';

      await saveDigestSource('backend_digest');
      await saveChannelDigest('backend', 'backend_digest', 'backend');
      await followKeyword('nodejs');
      await saveChannelPosts('mh', ['backend'], 'nodejs', 3);
      await con.getRepository(ContentPreferenceSource).save({
        userId: '1',
        feedId: '1',
        referenceId: 'backend_digest',
        sourceId: 'backend_digest',
        status: ContentPreferenceStatus.Blocked,
      });

      const res = await client.query(DAILY_HEADLINES_BACKFILL_QUERY);

      expect(res.errors).toBeFalsy();
      const follows = await con
        .getRepository(ContentPreferenceSource)
        .findBy({ userId: '1', status: ContentPreferenceStatus.Follow });
      expect(follows).toHaveLength(0);
      const action = await con.getRepository(UserAction).findOneBy({
        userId: '1',
        type: UserActionType.DailyHeadlinesBackfilled,
      });
      expect(action).not.toBeNull();
    });

    it('should mark backfilled without seeding when the user has no onboarding tags', async () => {
      loggedUser = '1';

      await saveDigestSource('backend_digest');
      await saveChannelDigest('backend', 'backend_digest', 'backend');
      await saveChannelPosts('mh', ['backend'], 'nodejs', 3);

      const res = await client.query(DAILY_HEADLINES_BACKFILL_QUERY);

      expect(res.errors).toBeFalsy();
      const follows = await con
        .getRepository(ContentPreferenceSource)
        .findBy({ userId: '1' });
      expect(follows).toHaveLength(0);
      const action = await con.getRepository(UserAction).findOneBy({
        userId: '1',
        type: UserActionType.DailyHeadlinesBackfilled,
      });
      expect(action).not.toBeNull();
    });
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

  it('should exclude highlights whose post is deleted or not visible', async () => {
    await createTestPosts();
    await con.getRepository(ArticlePost).update('h2', { deleted: true });
    await con.getRepository(ArticlePost).update('h3', { visible: false });
    await saveCanonicalHighlights([
      {
        postId: 'h1',
        channel: 'vibes',
        highlightedAt: new Date('2026-03-19T10:40:00.000Z'),
        headline: 'Visible headline',
        significance: HighlightSignificance.Breaking,
      },
      {
        postId: 'h2',
        channel: 'vibes',
        highlightedAt: new Date('2026-03-19T10:35:00.000Z'),
        headline: 'Deleted post headline',
        significance: HighlightSignificance.Notable,
      },
      {
        postId: 'h3',
        channel: 'agentic',
        highlightedAt: new Date('2026-03-19T10:30:00.000Z'),
        headline: 'Invisible post headline',
        significance: HighlightSignificance.Routine,
      },
    ]);

    const res = await client.query(POST_HIGHLIGHTS_FEED_QUERY, {
      variables: { first: 10 },
    });

    expect(res.errors).toBeFalsy();
    expect(
      res.data.postHighlightsFeed.edges.map(({ node }) => node.post.id),
    ).toEqual(['h1']);
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

describe('mutation markDailySeen', () => {
  const MUTATION = `mutation MarkDailySeen { markDailySeen { _ } }`;

  const dailyKey = (userId = '1') =>
    generateStorageKey(StorageTopic.Boot, StorageKey.DailyFeed, userId);

  beforeEach(async () => {
    await ioRedisPool.execute((client) => client.del(dailyKey()));
  });

  it('should require authentication', () =>
    testMutationErrorCode(client, { mutation: MUTATION }, 'UNAUTHENTICATED'));

  it('should set the daily flag with an expiry until the next drop', async () => {
    loggedUser = '1';
    await saveFixtures(con, User, usersFixture);

    const res = await client.mutate(MUTATION);

    expect(res.errors).toBeFalsy();
    expect(await getRedisObject(dailyKey())).toBe('1');
    expect(await getRedisObjectExpiry(dailyKey())).toBeGreaterThan(0);
  });
});
