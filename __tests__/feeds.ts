import { createSquadWelcomePost, feedToFilters, Ranking } from '../src/common';
import {
  AdvancedSettings,
  ArticlePost,
  BookmarkList,
  Feed,
  FeedAdvancedSettings,
  FeedSource,
  FeedTag,
  FreeformPost,
  Keyword,
  MachineSource,
  Post,
  PostKeyword,
  PostTag,
  PostType,
  SharePost,
  Source,
  SourceMember,
  SourceType,
  User,
  View,
  WelcomePost,
  YouTubePost,
} from '../src/entity';
import { SourceMemberRoles } from '../src/roles';
import { Category } from '../src/entity/Category';
import { FastifyInstance } from 'fastify';
import {
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testMutationErrorCode,
  testQueryErrorCode,
} from './helpers';
import { sourcesFixture } from './fixture/source';
import {
  postKeywordsFixture,
  postsFixture,
  postTagsFixture,
  sharedPostsFixture,
  videoPostsFixture,
} from './fixture/post';
import nock from 'nock';
import { deleteKeysByPattern, ioRedisPool } from '../src/redis';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { randomUUID } from 'crypto';
import { usersFixture } from './fixture/user';
import { base64 } from 'graphql-relay/utils/base64';
import { cachedFeedClient } from '../src/integrations/feed';

let app: FastifyInstance;
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
  app = state.app;
});

beforeEach(async () => {
  loggedUser = null;

  await saveFixtures(con, AdvancedSettings, advancedSettings);
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
  await saveFixtures(con, ArticlePost, sharedPostsFixture);
  await saveFixtures(con, PostTag, postTagsFixture);
  await saveFixtures(con, PostKeyword, postKeywordsFixture);
  await deleteKeysByPattern('feeds:*');
});

afterAll(() => app.close());

const advancedSettings: Partial<AdvancedSettings>[] = [
  {
    id: 1,
    title: 'Tech magazines',
    description: 'Description for Tech magazines',
    defaultEnabledState: true,
  },
  {
    id: 2,
    title: 'Non-editorial content',
    description: 'Description for Non-editorial content',
    defaultEnabledState: true,
  },
  {
    id: 3,
    title: 'Release notes',
    description: 'Description for Release notes',
    defaultEnabledState: true,
  },
  {
    id: 4,
    title: 'Code examples',
    description: 'Description for Code examples',
    defaultEnabledState: true,
  },
  {
    id: 5,
    title: 'Company blogs',
    description: 'Description for Company blogs',
    defaultEnabledState: true,
  },
  {
    id: 6,
    title: 'Another Settings',
    description: 'Description for Another Settings',
    defaultEnabledState: true,
  },
  {
    id: 7,
    title: 'Setting with options',
    description: 'Description for Another Settings',
    defaultEnabledState: true,
    group: 'content_types',
    options: {
      type: PostType.VideoYouTube,
    },
  },
];

const categories: Partial<Category>[] = [
  {
    id: 'FE',
    emoji: '🌈',
    title: 'Frontend',
    tags: ['html', 'javascript'],
  },
  {
    id: 'BE',
    emoji: '⚙️',
    title: 'Backend',
    tags: ['golang', 'javascript'],
  },
];

const saveFeedFixtures = async (): Promise<void> => {
  await saveFixtures(con, Feed, [{ id: '1', userId: '1' }]);
  await saveFixtures(con, FeedAdvancedSettings, [
    { feedId: '1', advancedSettingsId: 1, enabled: true },
    { feedId: '1', advancedSettingsId: 2, enabled: false },
    { feedId: '1', advancedSettingsId: 3, enabled: false },
    { feedId: '1', advancedSettingsId: 4, enabled: true },
    { feedId: '1', advancedSettingsId: 7, enabled: true },
  ]);
  await saveFixtures(con, Category, categories);
  await saveFixtures(con, FeedTag, [
    { feedId: '1', tag: 'html' },
    { feedId: '1', tag: 'javascript' },
    { feedId: '1', tag: 'golang', blocked: true },
  ]);
  await saveFixtures(con, FeedSource, [
    { feedId: '1', sourceId: 'b' },
    { feedId: '1', sourceId: 'c' },
  ]);
};

const saveAdvancedSettingsFiltersFixtures = async (): Promise<void> => {
  await saveFixtures(con, Feed, [{ id: '1', userId: '1' }]);
  await saveFixtures(con, MachineSource, [
    {
      id: 'includedSource',
      name: 'IS',
      image: 'http://image.com/c',
      advancedSettings: [2],
      handle: 'includedSource',
    },
    {
      id: 'excludedSource',
      name: 'ES',
      image: 'http://image.com/c',
      advancedSettings: [1],
      handle: 'excludedSource',
    },
    {
      id: 'settingsCombinationSource',
      name: 'SCS',
      image: 'http://image.com/c',
      advancedSettings: [1, 2],
      handle: 'settingsCombinationSource',
    },
    {
      id: 'experimentExcludedSource',
      name: 'ExES',
      image: 'http://image.com/c',
      advancedSettings: [5],
      handle: 'experimentExcludedSource',
    },
    {
      id: 'experimentIncludedSource',
      name: 'ExIS',
      image: 'http://image.com/c',
      advancedSettings: [6],
      handle: 'experimentIncludedSource',
    },
  ]);
  await saveFixtures(con, ArticlePost, [
    {
      id: 'includedPost',
      shortId: 'ip1',
      title: 'Included Post',
      url: 'http://ip1.com',
      score: 0,
      sourceId: 'includedSource',
      tagsStr: 'javascript,webdev',
    },
    {
      id: 'excludedPost',
      shortId: 'ep1',
      title: 'Excluded Post',
      url: 'http://ip2.com',
      score: 0,
      sourceId: 'excludedSource',
      tagsStr: 'javascript,webdev',
    },
    {
      id: 'excludedPostAgain',
      shortId: 'epa1',
      title: 'This should be excluded as well',
      url: 'http://ip3.com',
      score: 0,
      sourceId: 'settingsCombinationSource',
      tagsStr: 'javascript,webdev',
    },
  ] as ArticlePost[]);
  await saveFixtures(con, SharePost, [
    {
      id: 'sourcePost',
      shortId: 'nsp1',
      title: 'Source Post',
      score: 0,
      sourceId: 'p',
      tagsStr: 'javascript,webdev',
    },
  ] as SharePost[]);
  await saveFixtures(con, FeedAdvancedSettings, [
    { feedId: '1', advancedSettingsId: 1, enabled: false },
    { feedId: '1', advancedSettingsId: 2, enabled: true },
    { feedId: '1', advancedSettingsId: 3, enabled: true },
    { feedId: '1', advancedSettingsId: 4, enabled: false },
    { feedId: '1', advancedSettingsId: 7, enabled: false },
  ]);
};

const feedFields = (extra = '') => `
pageInfo {
  endCursor
  hasNextPage
}
edges {
  node {
    ${extra}
    id
    url
    title
    readTime
    tags
    type
    source {
      id
      name
      image
      public
    }
  }
}`;

describe('query anonymousFeed', () => {
  const variables = {
    ranking: Ranking.POPULARITY,
    first: 10,
  };

  const QUERY = `
  query AnonymousFeed($filters: FiltersInput, $ranking: Ranking, $first: Int, $version: Int) {
    anonymousFeed(filters: $filters, ranking: $ranking, first: $first, version: $version) {
      ${feedFields()}
    }
  }
`;

  it('should return anonymous feed with no filters ordered by popularity', async () => {
    await con.getRepository(Post).delete({ id: 'p6' });
    const res = await client.query(QUERY, { variables });
    expect(res.data).toMatchSnapshot();
  });

  it('should return anonymous feed with no filters ordered by time', async () => {
    const res = await client.query(QUERY, {
      variables: { ...variables, ranking: Ranking.TIME },
    });
    delete res.data.anonymousFeed.pageInfo.endCursor;
    expect(res.data).toMatchSnapshot();
  });

  it('should return anonymous feed filtered by sources', async () => {
    const res = await client.query(QUERY, {
      variables: { ...variables, filters: { includeSources: ['a', 'b'] } },
    });
    expect(res.data).toMatchSnapshot();
  });

  it('should return anonymous feed filtered by tags', async () => {
    const res = await client.query(QUERY, {
      variables: { ...variables, filters: { includeTags: ['html', 'webdev'] } },
    });
    expect(res.data).toMatchSnapshot();
  });

  it('should return anonymous feed while excluding sources', async () => {
    await con.getRepository(Post).delete({ id: 'p6' });
    const res = await client.query(QUERY, {
      variables: { ...variables, filters: { excludeSources: ['a'] } },
    });
    expect(res.data).toMatchSnapshot();
  });

  it('should return feed while excluding sources based on advanced settings', async () => {
    await con.getRepository(Post).delete({ id: 'p6' });
    await saveAdvancedSettingsFiltersFixtures();

    const filters = await feedToFilters(con, '1', '1');
    delete filters.sourceIds;
    delete filters.excludeTypes;
    const res = await client.query(QUERY, {
      variables: { ...variables, filters },
    });
    expect(res.data).toMatchSnapshot();
  });

  it('should return anonymous feed filtered by tags and sources', async () => {
    const res = await client.query(QUERY, {
      variables: {
        ...variables,
        filters: {
          includeTags: ['javascript'],
          includeSources: ['a', 'b'],
        },
      },
    });
    expect(res.data).toMatchSnapshot();
  });

  it('should remove banned posts from the feed', async () => {
    await con.getRepository(Post).delete({ id: 'p6' });
    await con.getRepository(Post).update({ id: 'p5' }, { banned: true });

    const res = await client.query(QUERY, { variables });
    expect(res.data).toMatchSnapshot();
  });

  it('should remove posts with "showOnFeed" false', async () => {
    await con.getRepository(Post).delete({ id: 'p6' });
    await con.getRepository(Post).update({ id: 'p5' }, { showOnFeed: false });

    const res = await client.query(QUERY, { variables });
    expect(res.data).toMatchSnapshot();
  });

  it('should return anonymous feed v2', async () => {
    nock('http://localhost:6000')
      .post('/feed.json', {
        total_pages: 40,
        page_size: 11,
        fresh_page_size: '4',
        providers: {
          fresh: {
            enable: true,
            remove_engaged_posts: true,
            page_size_fraction: 0.1,
          },
          engaged: {
            enable: true,
            remove_engaged_posts: true,
            page_size_fraction: 1,
            fallback_provider: 'fresh',
          },
        },
      })
      .reply(200, {
        data: [{ post_id: 'p1' }, { post_id: 'p4' }],
      });
    const res = await client.query(QUERY, {
      variables: { ...variables, version: 2 },
    });
    expect(res.data).toMatchSnapshot();
  });

  it('should safetly handle a case where the feed is empty', async () => {
    nock('http://localhost:6000').post('/feed.json').reply(200, {
      data: [],
    });
    const res = await client.query(QUERY, {
      variables: { ...variables, version: 2 },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });

  it('should return anonymous feed v2 and ignore existing filters', async () => {
    loggedUser = '1';
    await con.getRepository(Feed).save({ id: '1', userId: '1' });
    await con.getRepository(FeedTag).save([
      { feedId: '1', tag: 'javascript' },
      { feedId: '1', tag: 'golang' },
      { feedId: '1', tag: 'python', blocked: true },
      { feedId: '1', tag: 'java', blocked: true },
    ]);
    await con.getRepository(FeedSource).save([
      { feedId: '1', sourceId: 'a' },
      { feedId: '1', sourceId: 'b' },
    ]);

    nock('http://localhost:6000')
      .post('/feed.json', {
        total_pages: 40,
        page_size: 11,
        fresh_page_size: '4',
        providers: {
          fresh: {
            enable: true,
            remove_engaged_posts: true,
            page_size_fraction: 0.1,
          },
          engaged: {
            enable: true,
            remove_engaged_posts: true,
            page_size_fraction: 1,
            fallback_provider: 'fresh',
          },
        },
        user_id: '1',
      })
      .reply(200, {
        data: [{ post_id: 'p1' }, { post_id: 'p4' }],
      });
    const res = await client.query(QUERY, {
      variables: { ...variables, version: 2 },
    });
    expect(res.data).toMatchSnapshot();
  });
});

describe('query anonymousFeed by time', () => {
  const variables = {
    ranking: Ranking.TIME,
    first: 10,
  };

  const QUERY = `
  query AnonymousFeed($filters: FiltersInput, $ranking: Ranking, $first: Int, $version: Int) {
    anonymousFeed(filters: $filters, ranking: $ranking, first: $first, version: $version) {
      ${feedFields()}
    }
  }
`;

  it('should return anonymous feed with no filters ordered by time', async () => {
    await con.getRepository(Post).delete({ id: 'p6' });
    const res = await client.query(QUERY, {
      variables: { ...variables },
    });
    delete res.data.anonymousFeed.pageInfo.endCursor;
    expect(res.data).toMatchSnapshot();
  });
});

describe('query feed', () => {
  const variables = {
    ranking: Ranking.POPULARITY,
    first: 10,
  };

  const QUERY = `
  query Feed($ranking: Ranking, $first: Int, $after: String, $version: Int, $unreadOnly: Boolean, $supportedTypes: [String!]) {
    feed(ranking: $ranking, first: $first, after: $after, version: $version, unreadOnly: $unreadOnly, supportedTypes: $supportedTypes) {
      ${feedFields()}
    }
  }
`;

  it('should not authorize when not logged-in', () =>
    testQueryErrorCode(client, { query: QUERY, variables }, 'UNAUTHENTICATED'));

  it('should return feed with preconfigured filters', async () => {
    loggedUser = '1';
    await saveFeedFixtures();

    const res = await client.query(QUERY, { variables });
    expect(res.data).toMatchSnapshot();
  });

  describe('youtube content', () => {
    beforeEach(async () => {
      await saveFixtures(con, YouTubePost, videoPostsFixture);
      await saveFeedFixtures();
      await con.getRepository(PostKeyword).save([
        { keyword: 'backend', postId: videoPostsFixture[0].id },
        { keyword: 'javascript', postId: videoPostsFixture[0].id },
      ]);
    });

    it('should include video content by default', async () => {
      loggedUser = '1';

      await con.getRepository(FeedAdvancedSettings).delete({
        feedId: '1',
        advancedSettingsId: 7,
      });

      const res = await client.query(QUERY, {
        variables: {
          ...variables,
          supportedTypes: ['article', 'video:youtube'],
        },
      });
      expect(res.data).toMatchSnapshot();
      res.data.feed.edges.map((post) => {
        expect(
          ['article', 'video:youtube'].includes(post.node.type),
        ).toBeTruthy();
      });
    });

    it('should include video content when it is enabled by the user', async () => {
      loggedUser = '1';

      const res = await client.query(QUERY, {
        variables: {
          ...variables,
          supportedTypes: ['article', 'video:youtube'],
        },
      });
      expect(res.data).toMatchSnapshot();
      res.data.feed.edges.map((post) => {
        expect(
          ['article', 'video:youtube'].includes(post.node.type),
        ).toBeTruthy();
      });
    });

    it('should exclude video content when it is disabled by the user', async () => {
      loggedUser = '1';

      await saveFixtures(con, FeedAdvancedSettings, [
        { feedId: '1', advancedSettingsId: 7, enabled: false },
      ]);

      const res = await client.query(QUERY, {
        variables: {
          ...variables,
          supportedTypes: ['article', 'video:youtube'],
        },
      });
      expect(res.data).toMatchSnapshot();

      res.data.feed.edges.map((post) => {
        expect(post.node.type).not.toEqual('video:youtube');
      });
    });

    it('can filter out article posts', async () => {
      loggedUser = '1';

      await saveFixtures(con, FeedAdvancedSettings, [
        { feedId: '1', advancedSettingsId: 7, enabled: false },
      ]);
      await con.getRepository(AdvancedSettings).update(
        { id: 7 },
        {
          options: {
            type: PostType.Article,
          },
        },
      );

      const res = await client.query(QUERY, {
        variables: {
          ...variables,
          supportedTypes: ['article', 'video:youtube'],
        },
      });
      expect(res.data).toMatchSnapshot();

      res.data.feed.edges.map((post) => {
        expect(post.node.type).not.toEqual('article');
      });
    });
  });

  it('should return preconfigured feed with tags filters only', async () => {
    loggedUser = '1';
    await saveFixtures(con, Feed, [{ id: '1', userId: '1' }]);
    await saveFixtures(con, FeedTag, [{ feedId: '1', tag: 'html' }]);

    const res = await client.query(QUERY, { variables });
    expect(res.data).toMatchSnapshot();
  });

  it('should return preconfigured feed with blocked tags filters only', async () => {
    loggedUser = '1';
    await con.getRepository(Post).delete({ id: 'p6' });
    await saveFixtures(con, Feed, [{ id: '1', userId: '1' }]);
    await saveFixtures(con, FeedTag, [
      { feedId: '1', tag: 'html', blocked: true },
    ]);

    const res = await client.query(QUERY, { variables });
    expect(res.data).toMatchSnapshot();
  });

  it('should return preconfigured feed with tags and blocked tags filters', async () => {
    loggedUser = '1';
    await saveFixtures(con, Feed, [{ id: '1', userId: '1' }]);
    await saveFixtures(con, FeedTag, [
      { feedId: '1', tag: 'javascript' },
      { feedId: '1', tag: 'webdev', blocked: true },
    ]);

    const res = await client.query(QUERY, { variables });
    expect(res.data).toMatchSnapshot();
  });

  it('should return preconfigured feed with sources filters only', async () => {
    loggedUser = '1';
    await con.getRepository(Post).delete({ id: 'p6' });
    await saveFixtures(con, Feed, [{ id: '1', userId: '1' }]);
    await saveFixtures(con, FeedSource, [{ feedId: '1', sourceId: 'a' }]);

    const res = await client.query(QUERY, { variables });
    expect(res.data).toMatchSnapshot();
  });

  it('should return preconfigured feed with sources filtered based on advanced settings', async () => {
    loggedUser = '1';
    const repo = con.getRepository(Post);
    await repo.delete({ id: 'p6' });
    await saveAdvancedSettingsFiltersFixtures();
    await repo.update({ id: 'p1' }, { score: 2 });
    await repo.update({ id: 'includedPost' }, { score: 1 });

    const res = await client.query(QUERY, { variables });
    expect(res.data).toMatchSnapshot();
  });

  it('should return preconfigured feed with no filters', async () => {
    loggedUser = '1';
    await con.getRepository(Post).delete({ id: 'p6' });
    await saveFixtures(con, Feed, [{ id: '1', userId: '1' }]);

    const res = await client.query(QUERY, { variables });
    expect(res.data).toMatchSnapshot();
  });

  it('should return unread posts from preconfigured feed', async () => {
    loggedUser = '1';
    await con.getRepository(Post).delete({ id: 'p6' });
    await saveFixtures(con, Feed, [{ id: '1', userId: '1' }]);
    await con.getRepository(View).save([{ userId: '1', postId: 'p1' }]);

    const res = await client.query(QUERY, {
      variables: { ...variables, unreadOnly: true },
    });
    expect(res.data).toMatchSnapshot();
  });

  it('should remove banned posts from the feed', async () => {
    loggedUser = '1';
    await saveFeedFixtures();
    await con.getRepository(Post).update({ id: 'p4' }, { banned: true });

    const res = await client.query(QUERY);
    expect(res.data).toMatchSnapshot();
  });

  it('should remove deleted posts from the feed', async () => {
    loggedUser = '1';
    await saveFeedFixtures();
    await con.getRepository(Post).update({ id: 'p4' }, { deleted: true });

    const res = await client.query(QUERY);
    expect(res.data).toMatchSnapshot();
  });

  it('should return feed with vector config based on user state', async () => {
    loggedUser = '1';
    nock('http://localhost:6001')
      .post('/api/v1/user/profile', {
        user_id: '1',
        providers: {
          personalise: {},
        },
      })
      .reply(200, { personalise: { state: 'personalised' } });
    nock('http://localhost:6000')
      .post('/feed.json', {
        total_pages: 40,
        page_size: 11,
        fresh_page_size: '4',
        feed_config_name: 'vector',
        user_id: '1',
      })
      .reply(200, {
        data: [{ post_id: 'p1' }, { post_id: 'p4' }],
      });
    const res = await client.query(QUERY, {
      variables: { ...variables, version: 15 },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.feed.edges.length).toEqual(2);
  });

  it('should support feed service side caching', async () => {
    loggedUser = '1';
    nock('http://localhost:6001')
      .post('/api/v1/user/profile', {
        user_id: '1',
        providers: {
          personalise: {},
        },
      })
      .reply(200, { personalise: { state: 'personalised' } });
    nock('http://localhost:6000')
      .post('/feed.json', (body) => body.cursor === 'a')
      .reply(200, {
        data: [{ post_id: 'p1' }, { post_id: 'p4' }],
        cursor: 'b',
      });
    const res = await client.query(QUERY, {
      variables: { ...variables, version: 20, after: 'a' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.feed.edges.length).toEqual(2);
    expect(res.data.feed.pageInfo.endCursor).toEqual('b');
  });

  it('should return only article posts by default', async () => {
    loggedUser = '1';
    await saveFeedFixtures();
    await con
      .getRepository(Post)
      .update({ id: 'p4' }, { type: PostType.Share });

    const res = await client.query(QUERY);
    expect(res.data).toMatchSnapshot();
  });

  it('should respect the supportedTypes argument', async () => {
    loggedUser = '1';
    await saveFeedFixtures();
    await con
      .getRepository(Post)
      .update({ id: 'p4' }, { type: PostType.Share });

    const res = await client.query(QUERY, {
      variables: { supportedTypes: ['article', 'share'] },
    });
    expect(res.data).toMatchSnapshot();
  });
});

describe('query feedByConfig', () => {
  const variables = {
    first: 10,
    config: JSON.stringify({ key: 'value' }),
  };

  const QUERY = `
  query FeedByConfig($first: Int, $config: String!) {
    feedByConfig(first: $first, config: $config) {
      ${feedFields()}
    }
  }
`;

  it('should not authorize when private routes are not enabled', async () => {
    process.env.ENABLE_PRIVATE_ROUTES = 'false';
    await testQueryErrorCode(
      client,
      {
        query: QUERY,
        variables,
      },
      'UNAUTHENTICATED',
    );
    process.env.ENABLE_PRIVATE_ROUTES = 'true';
  });

  it('should send provided config to feed service', async () => {
    nock('http://localhost:6000')
      .post('/feed.json', {
        key: 'value',
        total_pages: 40,
        page_size: 11,
        fresh_page_size: '4',
        offset: 0,
      })
      .reply(200, {
        data: [{ post_id: 'p1' }],
      });

    const res = await client.query(QUERY, { variables });
    expect(res.errors).toBeFalsy();
    expect(res.data.feedByConfig.edges[0].node.id).toEqual('p1');
  });
});

describe('query sourceFeed', () => {
  let additionalProps = '';
  const QUERY = (
    source: string,
    ranking: Ranking = Ranking.POPULARITY,
    now = new Date(),
    first = 10,
    after = '',
  ): string => `{
    sourceFeed(source: "${source}", ranking: ${ranking}, now: "${now.toISOString()}", first: ${first}, supportedTypes: ["article", "share", "welcome", "freeform"], after: "${after}") {
      ${feedFields(`pinnedAt ${additionalProps}`)}
    }
  }`;

  beforeEach(() => {
    additionalProps = '';
  });

  it('should return a single source feed', async () => {
    const res = await client.query(QUERY('b'));
    res.data.sourceFeed.edges.forEach(({ node }) =>
      expect(node.source.id).toEqual('b'),
    );
  });

  it('should display a banned post in source feed', async () => {
    await con.getRepository(Post).update({ id: 'p5' }, { banned: true });
    const res = await client.query(QUERY('b'));
    expect(
      res.data.sourceFeed.edges.some(({ node }) => node.id === 'p5'),
    ).toBeTruthy();
  });

  it('should display a welcome post first in source feed', async () => {
    const createdAt = new Date('2020-09-21T07:15:51.247Z');
    await con.getRepository(Post).update({ id: 'p5' }, { createdAt });
    const res1 = await client.query(QUERY('b', Ranking.TIME));
    expect(res1.data.sourceFeed.edges[0].node.id).not.toEqual('p5');

    const repo = con.getRepository(Source);
    await repo.update({ id: 'b' }, { type: SourceType.Squad });
    const source = await repo.findOneBy({ id: 'b' });

    await con.getRepository(User).save(usersFixture[0]);
    const post = await createSquadWelcomePost(con, source, '1', {
      createdAt: new Date(),
    });
    const res2 = await client.query(QUERY('b', Ranking.TIME));
    expect(res2.data.sourceFeed.edges[0].node.id).toEqual(post.id);
    expect(res2.data.sourceFeed.edges.length).toBeGreaterThan(1);
  });

  it('should display return the right posts after the first page being pinned posts', async () => {
    await con.getRepository(User).save({ id: '1', name: 'Lee' });
    const createdAt1 = new Date('2020-09-21T01:15:51.247Z');
    const createdAt2 = new Date('2020-09-21T02:15:51.247Z');
    const createdAt3 = new Date('2020-09-21T03:15:51.247Z');
    const createdAt4 = new Date('2020-09-21T04:15:51.247Z');
    const createdAt5 = new Date('2020-09-21T05:15:51.247Z');
    const repo = con.getRepository(Source);
    await repo.update({ id: 'b' }, { type: SourceType.Squad });
    const source = await repo.findOneBy({ id: 'b' });
    // used welcome post as a sample of pinned posts
    const pin = await createSquadWelcomePost(con, source, '1', {
      createdAt: createdAt1,
    });
    await createSquadWelcomePost(con, source, '1', { createdAt: createdAt2 });
    await createSquadWelcomePost(con, source, '1', { createdAt: createdAt3 });
    await createSquadWelcomePost(con, source, '1', { createdAt: createdAt4 });
    await createSquadWelcomePost(con, source, '1', { createdAt: createdAt5 });
    await con
      .getRepository(Post)
      .update({ id: 'p5' }, { createdAt: new Date() });

    const unbased = base64(
      `time:${createdAt1.getTime()};pinned:${pin.pinnedAt.getTime()}`,
    );
    const query = QUERY('b', Ranking.TIME, new Date(), 5, unbased);
    const res = await client.query(query);

    expect(res.data.sourceFeed.edges[0].node.id).toEqual('p5');
    expect(res.data.sourceFeed.edges).toMatchSnapshot();
  });

  it('should display return the right posts after the first page being a mix of pinned and unpinned posts', async () => {
    await con.getRepository(User).save({ id: '1', name: 'Lee' });
    const createdAt1 = new Date('2020-09-21T01:15:51.247Z');
    const createdAt2 = new Date('2020-09-21T02:15:51.247Z');
    const createdAt3 = new Date('2020-09-21T03:15:51.247Z');
    const createdAt4 = new Date('2020-09-21T04:15:51.247Z');
    const repo = con.getRepository(Source);
    await repo.update({ id: 'b' }, { type: SourceType.Squad });
    const source = await repo.findOneBy({ id: 'b' });
    // used welcome post as a sample of pinned posts
    await createSquadWelcomePost(con, source, '1', { createdAt: createdAt1 });
    await createSquadWelcomePost(con, source, '1', { createdAt: createdAt2 });
    await createSquadWelcomePost(con, source, '1', { createdAt: createdAt3 });
    await createSquadWelcomePost(con, source, '1', { createdAt: createdAt4 });
    await con
      .getRepository(Post)
      .update({ id: 'p5' }, { createdAt: new Date() });
    const post = await con.getRepository(Post).findOneBy({ id: 'p5' });
    const unbased = base64(`time:${post.createdAt.getTime()}`);
    const query = QUERY('b', Ranking.TIME, new Date(), 5, unbased);
    const res = await client.query(query);

    expect(res.data.sourceFeed.edges[0].node.id).toEqual('p2');
    expect(res.data.sourceFeed.edges).toMatchSnapshot();
  });

  it('should not display a banned post for community source', async () => {
    await con
      .getRepository(Post)
      .update({ id: 'p6' }, { sourceId: 'community' });
    await con
      .getRepository(Post)
      .update({ id: 'p5' }, { banned: true, sourceId: 'community' });
    const res = await client.query(QUERY('community'));
    expect(
      res.data.sourceFeed.edges.every(({ node }) => node.id !== 'p5'),
    ).toBeTruthy();
  });

  it('should throw an error when accessing private source', async () => {
    await con.getRepository(Source).update({ id: 'a' }, { private: true });
    return testQueryErrorCode(client, { query: QUERY('a') }, 'FORBIDDEN');
  });

  it('should return a private source feed when user is a member', async () => {
    loggedUser = '1';
    await con.getRepository(Source).update({ id: 'b' }, { private: true });
    await con.getRepository(User).save(usersFixture[0]);
    await con.getRepository(SourceMember).save([
      {
        userId: '1',
        sourceId: 'b',
        role: SourceMemberRoles.Admin,
        referralToken: randomUUID(),
        createdAt: new Date(2022, 11, 19),
      },
    ]);
    const res = await client.query(QUERY('b'));
    res.data.sourceFeed.edges.forEach(({ node }) =>
      expect(node.source.id).toEqual('b'),
    );
  });

  it('should return a freeform or welcome post without image', async () => {
    loggedUser = '1';
    additionalProps = 'type image';
    await con.getRepository(User).save(usersFixture[0]);
    const repo = con.getRepository(Source);
    await repo.update({ id: 'b' }, { private: true });
    const source = await repo.findOneBy({ id: 'b' });
    const welcome = await createSquadWelcomePost(con, source, '1');
    const freeform = await createSquadWelcomePost(con, source, '1');
    await con
      .getRepository(Post)
      .update({ id: freeform.id }, { type: PostType.Freeform });
    await con
      .getRepository(FreeformPost)
      .update({ id: freeform.id }, { image: null });
    await con
      .getRepository(WelcomePost)
      .update({ id: welcome.id }, { image: null });
    await con.getRepository(SourceMember).save([
      {
        userId: '1',
        sourceId: 'b',
        role: SourceMemberRoles.Admin,
        referralToken: randomUUID(),
        createdAt: new Date(2022, 11, 19),
      },
    ]);

    const res = await client.query(QUERY('b'));
    const edges = res.data?.sourceFeed?.edges;
    edges.forEach(({ node }) => expect(node.source.id).toEqual('b'));
    const welcomePost = edges.find(
      ({ node }) => node.type === PostType.Welcome,
    );
    expect(welcomePost.node.image).toBeNull();
    const freeformPost = edges.find(
      ({ node }) => node.type === PostType.Freeform,
    );
    expect(freeformPost.node.image).toBeNull();
  });

  it('should disallow access to feed for public source for blocked members', async () => {
    loggedUser = '1';
    await con.getRepository(User).save(usersFixture[0]);
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad, private: false });
    await con.getRepository(SourceMember).save({
      sourceId: 'a',
      userId: '1',
      referralToken: 'rt2',
      role: SourceMemberRoles.Blocked,
    });

    return testQueryErrorCode(
      client,
      {
        query: QUERY('a'),
      },
      'FORBIDDEN',
    );
  });
});

describe('query tagFeed', () => {
  const QUERY = (
    tag: string,
    ranking: Ranking = Ranking.POPULARITY,
    now = new Date(),
    first = 10,
  ): string => `{
    tagFeed(tag: "${tag}", ranking: ${ranking}, now: "${now.toISOString()}", first: ${first}) {
      ${feedFields()}
    }
  }`;

  it('should return a single tag feed', async () => {
    const res = await client.query(QUERY('javascript'));
    expect(res.data).toMatchSnapshot();
  });
});

describe('query keywordFeed', () => {
  const QUERY = (
    keyword: string,
    ranking: Ranking = Ranking.POPULARITY,
    first = 10,
  ): string => `{
    keywordFeed(keyword: "${keyword}", ranking: ${ranking}, first: ${first}) {
      ${feedFields()}
    }
  }`;

  it('should return a single keyword feed', async () => {
    const res = await client.query(QUERY('javascript'));
    expect(res.data).toMatchSnapshot();
  });
});

describe('query feedSettings', () => {
  const QUERY = `{
    feedSettings {
      id
      userId
      includeTags
      blockedTags
      excludeSources {
        id
        name
        image
        public
      }
      advancedSettings {
        id
        enabled
        advancedSettings {
          id
          title
          description
          group
        }
      }
    }
  }`;

  it('should not authorize when not logged-in', () =>
    testQueryErrorCode(client, { query: QUERY }, 'UNAUTHENTICATED'));

  it('should return the feed settings', async () => {
    loggedUser = '1';
    await saveFeedFixtures();
    const res = await client.query(QUERY);
    expect(res.data).toMatchSnapshot();
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

describe('query rssFeeds', () => {
  const QUERY = `{
    rssFeeds {
      name, url
    }
  }`;

  it('should not authorize when not logged-in', () =>
    testQueryErrorCode(client, { query: QUERY }, 'UNAUTHENTICATED'));

  it('should return rss feeds', async () => {
    loggedUser = '1';
    const list = await con
      .getRepository(BookmarkList)
      .save({ userId: loggedUser, name: 'list' });
    const res = await client.query(QUERY);
    expect(res.data.rssFeeds).toEqual([
      { name: 'Recent news feed', url: 'http://localhost:4000/rss/f/1' },
      { name: 'Bookmarks', url: 'http://localhost:4000/rss/b/1' },
      {
        name: 'list',
        url: `http://localhost:4000/rss/b/l/${list.id.replace(/-/g, '')}`,
      },
    ]);
  });
});

describe('query authorFeed', () => {
  const QUERY = (
    author: string,
    ranking: Ranking = Ranking.POPULARITY,
    first = 10,
  ): string => `{
    authorFeed(author: "${author}", ranking: ${ranking}, first: ${first}) {
      ${feedFields(`
      isAuthor
      isScout
      `)}
    }
  }`;

  it('should return a single author feed with scout and author setting', async () => {
    await con.getRepository(User).save([
      {
        id: '1',
        name: 'Ido',
        image: 'https://daily.dev/ido.jpg',
        twitter: 'idoshamun',
      },
    ]);
    await con.getRepository(Post).update({ id: 'p1' }, { authorId: '1' });
    await con.getRepository(Post).update({ id: 'p3' }, { scoutId: '1' });

    const res = await client.query(QUERY('1'));
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });
});

describe('query mostUpvotedFeed', () => {
  const QUERY = (period = 7, first = 10): string => `{
    mostUpvotedFeed(first: ${first}, period: ${period}) {
      ${feedFields()}
    }
  }`;

  it('should return a most upvoted feed', async () => {
    const repo = con.getRepository(Post);
    const now = new Date();
    await repo.update({ id: 'p1' }, { upvotes: 20 });
    await repo.update({ id: 'p3' }, { upvotes: 15 });
    await repo.update(
      { id: 'p2' },
      {
        upvotes: 30,
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 10),
      },
    );

    const res = await client.query(QUERY());
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });

  it('should return a most upvoted feed of the month', async () => {
    const repo = con.getRepository(Post);
    const now = new Date();
    await repo.update({ id: 'p1' }, { upvotes: 20 });
    await repo.update({ id: 'p3' }, { upvotes: 15 });
    await repo.update(
      { id: 'p2' },
      {
        upvotes: 30,
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 10),
      },
    );

    const res = await client.query(QUERY(30));
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });

  it('should not return posts from private squads', async () => {
    const sourceRepo = con.getRepository(Source);
    await sourceRepo.update({ id: 'squad' }, { type: SourceType.Squad });
    const repo = con.getRepository(Post);
    await repo.update({ id: 'p1' }, { upvotes: 20 });
    await repo.update({ id: 'p3' }, { upvotes: 15 });
    await repo.update({ id: 'p2' }, { upvotes: 30, sourceId: 'squad' });

    const res = await client.query(QUERY(30));
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });

  it('should not return posts from public squads', async () => {
    const sourceRepo = con.getRepository(Source);
    await sourceRepo.update(
      { id: 'squad' },
      { type: SourceType.Squad, private: false },
    );
    const repo = con.getRepository(Post);
    await repo.update({ id: 'p1' }, { upvotes: 20 });
    await repo.update({ id: 'p3' }, { upvotes: 15 });
    await repo.update({ id: 'p2' }, { upvotes: 30, sourceId: 'squad' });

    const res = await client.query(QUERY(30));
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });
});

describe('query mostDiscussedFeed', () => {
  const QUERY = (first = 10): string => `{
    mostDiscussedFeed(first: ${first}) {
      ${feedFields()}
    }
  }`;

  it('should return a most discussed feed', async () => {
    const repo = con.getRepository(Post);
    await repo.update({ id: 'p1' }, { comments: 5 });
    await repo.update({ id: 'p3' }, { comments: 2 });

    const res = await client.query(QUERY());
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });

  it('should not return posts from private squads', async () => {
    await con
      .getRepository(Source)
      .update({ id: 'squad' }, { type: SourceType.Squad });
    const repo = con.getRepository(Post);
    await repo.update({ id: 'p1' }, { comments: 6 });
    await repo.update({ id: 'p3' }, { comments: 5 });
    await repo.update({ id: 'p2' }, { comments: 5, sourceId: 'squad' });

    const res = await client.query(QUERY(30));
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });

  it('should not return posts from public squads', async () => {
    await con
      .getRepository(Source)
      .update({ id: 'squad' }, { type: SourceType.Squad, private: false });
    const repo = con.getRepository(Post);
    await repo.update({ id: 'p1' }, { comments: 6 });
    await repo.update({ id: 'p3' }, { comments: 5 });
    await repo.update({ id: 'p2' }, { comments: 5, sourceId: 'squad' });

    const res = await client.query(QUERY(30));
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });
});

describe('query randomTrendingPosts', () => {
  const QUERY = `query RandomTrendingPosts($first: Int, $post: ID) {
    randomTrendingPosts(first: $first, post: $post) {
      id
    }
  }`;

  beforeEach(async () => {
    const repo = con.getRepository(Post);
    await repo.update({ id: 'p1' }, { trending: 20 });
    await repo.update({ id: 'p3' }, { trending: 50 });
  });

  it('should return random trending posts', async () => {
    const res = await client.query(QUERY, { variables: { first: 10 } });
    expect(res.errors).toBeFalsy();
    expect(res.data.randomTrendingPosts.map((post) => post.id).sort()).toEqual([
      'p1',
      'p3',
    ]);
  });

  it('should filter out the given post', async () => {
    const res = await client.query(QUERY, {
      variables: { first: 10, post: 'p1' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.randomTrendingPosts.map((post) => post.id).sort()).toEqual([
      'p3',
    ]);
  });
});

describe('query randomSimilarPosts', () => {
  const QUERY = (first = 10): string => `{
    randomSimilarPosts(post: "p1", first: ${first}) {
      id
    }
  }`;

  it('should return random similar posts', async () => {
    const repo = con.getRepository(Post);
    await repo.update({}, { upvotes: 5 });
    const now = new Date();
    await con.getRepository(Keyword).save([
      { value: 'javascript', status: 'allow' },
      { value: 'webdev', status: 'deny' },
      { value: 'backend', status: 'allow' },
    ]);
    await con.getRepository(PostKeyword).save([
      { keyword: 'backend', postId: 'p2' },
      { keyword: 'javascript', postId: 'p3' },
    ]);
    await repo.update(
      { id: 'p4' },
      {
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30 * 8),
      },
    );

    const res = await client.query(QUERY());
    expect(res.errors).toBeFalsy();
    expect(res.data.randomSimilarPosts.map((post) => post.id).sort()).toEqual([
      'p3',
      'p5',
    ]);
  });
});

describe('query randomSimilarPostsByTags', () => {
  const QUERY = `query RandomSimilarPostsByTags($post: ID, $tags: [String]!, $first: Int) {
    randomSimilarPostsByTags(post: $post, first: $first, tags: $tags) {
      id
    }
  }`;

  // it('should return posts from feed service', async () => {
  //   nock('http://localhost:6000')
  //     .post('/feed.json', {
  //       feed_config_name: 'post_similarity',
  //       total_pages: 1,
  //       page_size: 3,
  //       post_id: 'p1',
  //       fresh_page_size: '1',
  //     })
  //     .reply(200, {
  //       data: [{ post_id: 'p3' }, { post_id: 'p5' }],
  //     });
  //
  //   const res = await client.query(QUERY, {
  //     variables: { post: 'p1', tags: ['webdev', 'javascript'] },
  //   });
  //   expect(res.errors).toBeFalsy();
  //   expect(
  //     res.data.randomSimilarPostsByTags.map((post) => post.id).sort(),
  //   ).toEqual(['p3', 'p5']);
  // });

  it('should fallback to old algorithm', async () => {
    nock('http://localhost:6000')
      .post('/feed.json', {
        feed_config_name: 'post_similarity',
        total_pages: 1,
        page_size: 3,
        post_id: 'p1',
        fresh_page_size: '1',
      })
      .reply(200, {
        data: [],
      });

    const repo = con.getRepository(Post);
    const now = new Date();
    await con.getRepository(Keyword).save([
      { value: 'javascript', status: 'allow' },
      { value: 'webdev', status: 'deny' },
      { value: 'backend', status: 'allow' },
    ]);
    await con.getRepository(PostKeyword).save([
      { keyword: 'backend', postId: 'p2' },
      { keyword: 'javascript', postId: 'p3' },
    ]);
    await repo.update(
      { id: 'p4' },
      {
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30 * 8),
      },
    );

    const res = await client.query(QUERY, {
      variables: { post: 'p1', tags: ['webdev', 'javascript'] },
    });
    expect(res.errors).toBeFalsy();
    expect(
      res.data.randomSimilarPostsByTags.map((post) => post.id).sort(),
    ).toEqual(['p3', 'p5']);
  });

  it('should fallback to old algorithm even when tags not provided', async () => {
    nock('http://localhost:6000')
      .post('/feed.json', {
        feed_config_name: 'post_similarity',
        total_pages: 1,
        page_size: 3,
        post_id: 'p1',
        fresh_page_size: '1',
      })
      .reply(200, {
        data: [],
      });

    const repo = con.getRepository(Post);
    const now = new Date();
    await con.getRepository(Keyword).save([
      { value: 'javascript', status: 'allow' },
      { value: 'webdev', status: 'deny' },
      { value: 'backend', status: 'allow' },
    ]);
    await con.getRepository(PostKeyword).save([
      { keyword: 'backend', postId: 'p2' },
      { keyword: 'javascript', postId: 'p3' },
    ]);
    await repo.update(
      { id: 'p4' },
      {
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30 * 8),
      },
    );

    const res = await client.query(QUERY, {
      variables: { post: 'p1', tags: [] },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.randomSimilarPostsByTags.length).toEqual(3);
  });
});

describe('query randomDiscussedPosts', () => {
  const QUERY = `query RandomDiscussedPosts($first: Int, $post: ID) {
    randomDiscussedPosts(first: $first, post: $post) {
      id
    }
  }`;

  beforeEach(async () => {
    const repo = con.getRepository(Post);
    await repo.update({ id: 'p1' }, { discussionScore: 20, comments: 10 });
    await repo.update({ id: 'p3' }, { discussionScore: 50, comments: 15 });
  });

  it('should return random discussed posts', async () => {
    const res = await client.query(QUERY, { variables: { first: 10 } });
    expect(res.errors).toBeFalsy();
    expect(res.data.randomDiscussedPosts.map((post) => post.id).sort()).toEqual(
      ['p1', 'p3'],
    );
  });

  it('should filter out the given post', async () => {
    const res = await client.query(QUERY, {
      variables: { first: 10, post: 'p1' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.randomDiscussedPosts.map((post) => post.id).sort()).toEqual(
      ['p3'],
    );
  });
});

describe('query tagsCategories', () => {
  it('should return a list of categories with a property of a string array as tags', async () => {
    const QUERY = `{
      tagsCategories {
        id
        title
        tags
        emoji
      }
    }`;

    await saveFeedFixtures();

    const res = await client.query(QUERY);

    expect(res.data).toMatchSnapshot();
  });
});

describe('query advancedSettings', () => {
  it('should return the list of the advanced settings', async () => {
    const QUERY = `{
      advancedSettings {
        id
        title
        description
        defaultEnabledState
      }
    }`;

    const res = await client.query(QUERY);
    expect(res.data).toMatchSnapshot();
  });
});

describe('mutation updateFeedAdvancedSettings', () => {
  const MUTATION = `
    mutation UpdateFeedAdvancedSettings($settings: [FeedAdvancedSettingsInput]!) {
      updateFeedAdvancedSettings(settings: $settings) {
        id
        enabled
      }
    }
  `;

  it('should not authorize when not logged-in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          settings: [
            { id: 1, enabled: true },
            { id: 2, enabled: false },
          ],
        },
      },
      'UNAUTHENTICATED',
    ));

  it('should add the new feed advanced settings', async () => {
    loggedUser = '1';
    await ioRedisPool.execute(async (client) => {
      return client.set(`${cachedFeedClient.getCacheKey('2', '1')}:time`, '1');
    });
    await ioRedisPool.execute(async (client) => {
      return client.set(`${cachedFeedClient.getCacheKey('2', '2')}:time`, '2');
    });
    await saveFixtures(con, Feed, [{ id: '1', userId: '1' }]);
    await saveFixtures(con, AdvancedSettings, advancedSettings);
    const res = await client.mutate(MUTATION, {
      variables: {
        settings: [
          { id: 1, enabled: true },
          { id: 2, enabled: false },
        ],
      },
    });

    expect(res.data).toMatchSnapshot();
    expect(
      await ioRedisPool.execute(async (client) => {
        return client.get(`${cachedFeedClient.getCacheKeyPrefix('1')}:update`);
      }),
    ).toBeTruthy();
  });

  it('should not fail if feed entity does not exists', async () => {
    loggedUser = '1';
    await saveFixtures(con, AdvancedSettings, advancedSettings);
    const res = await client.mutate(MUTATION, {
      variables: {
        settings: [
          { id: 1, enabled: true },
          { id: 2, enabled: false },
        ],
      },
    });

    expect(res.data).toMatchSnapshot();
  });

  it('should update existing feed advanced settings', async () => {
    loggedUser = '1';
    await ioRedisPool.execute(async (client) => {
      return client.set(`${cachedFeedClient.getCacheKey('2', '1')}:time`, '1');
    });
    await ioRedisPool.execute(async (client) => {
      return client.set(`${cachedFeedClient.getCacheKey('2', '2')}:time`, '2');
    });
    await saveFeedFixtures();
    const res = await client.mutate(MUTATION, {
      variables: {
        settings: [
          { id: 1, enabled: false },
          { id: 2, enabled: true },
          { id: 3, enabled: true },
          { id: 4, enabled: false },
        ],
      },
    });
    expect(res.data).toMatchSnapshot();
    expect(
      await ioRedisPool.execute(async (client) => {
        return client.get(`${cachedFeedClient.getCacheKeyPrefix('1')}:update`);
      }),
    ).toBeTruthy();
  });

  it('should ignore duplicates', async () => {
    loggedUser = '1';
    await saveFeedFixtures();
    const res = await client.mutate(MUTATION, {
      variables: {
        settings: [
          { id: 1, enabled: true },
          { id: 2, enabled: false },
          { id: 3, enabled: false },
          { id: 4, enabled: true },
        ],
      },
    });
    expect(res.data).toMatchSnapshot();
  });
});

describe('mutation addFiltersToFeed', () => {
  const MUTATION = `
  mutation AddFiltersToFeed($filters: FiltersInput!) {
    addFiltersToFeed(filters: $filters) {
      id
      userId
      includeTags
      blockedTags
      excludeSources {
        id
        name
        image
        public
      }
      advancedSettings {
        id
        enabled
      }
    }
  }`;

  it('should not authorize when not logged-in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { filters: { excludeSources: ['a'] } },
      },
      'UNAUTHENTICATED',
    ));

  it('should add the new feed settings', async () => {
    loggedUser = '1';
    await ioRedisPool.execute(async (client) => {
      return client.set(`${cachedFeedClient.getCacheKey('2', '1')}:time`, '1');
    });
    await ioRedisPool.execute(async (client) => {
      await client.set(`${cachedFeedClient.getCacheKey('2', '2')}:time`, '2');
    });
    await saveFixtures(con, Feed, [{ id: '2', userId: '1' }]);
    await saveFixtures(con, AdvancedSettings, advancedSettings);
    const res = await client.mutate(MUTATION, {
      variables: {
        filters: {
          includeTags: ['webdev', 'javascript'],
          excludeSources: ['a', 'b'],
          blockedTags: ['golang'],
        },
      },
    });
    expect(res.data).toMatchSnapshot();
    expect(
      await ioRedisPool.execute(async (client) => {
        return client.get(`${cachedFeedClient.getCacheKeyPrefix('1')}:update`);
      }),
    ).toBeTruthy();
  });

  it('should ignore duplicates', async () => {
    loggedUser = '1';
    await saveFeedFixtures();
    const res = await client.mutate(MUTATION, {
      variables: {
        filters: {
          includeTags: ['webdev', 'javascript'],
          excludeSources: ['a', 'b'],
          blockedTags: ['golang'],
        },
      },
    });
    expect(res.data).toMatchSnapshot();
  });

  it('should ignore non existing sources', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: {
        filters: {
          includeTags: ['webdev', 'javascript'],
          excludeSources: ['a', 'b', 'deleted'],
        },
      },
    });
    expect(res.data).toMatchSnapshot();
  });
});

describe('mutation removeFiltersFromFeed', () => {
  const MUTATION = `
  mutation RemoveFiltersFromFeed($filters: FiltersInput!) {
    removeFiltersFromFeed(filters: $filters) {
      id
      userId
      includeTags
      blockedTags
      excludeSources {
        id
        name
        image
        public
      }
      advancedSettings {
        id
        enabled
      }
    }
  }`;

  it('should not authorize when not logged-in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { filters: { excludeSources: ['a'] } },
      },
      'UNAUTHENTICATED',
    ));

  it('should remove existing filters', async () => {
    loggedUser = '1';
    await ioRedisPool.execute(async (client) => {
      return client.set(`${cachedFeedClient.getCacheKey('2', '1')}:time`, '1');
    });
    await ioRedisPool.execute(async (client) => {
      return client.set(`${cachedFeedClient.getCacheKey('2', '2')}:time`, '2');
    });
    await saveFeedFixtures();
    const res = await client.mutate(MUTATION, {
      variables: {
        filters: {
          includeTags: ['webdev', 'javascript'],
          excludeSources: ['a', 'b'],
          blockedTags: ['golang'],
        },
      },
    });
    expect(res.data).toMatchSnapshot();
    expect(
      await ioRedisPool.execute(async (client) => {
        return client.get(`${cachedFeedClient.getCacheKeyPrefix('1')}:update`);
      }),
    ).toBeTruthy();
  });
});

describe('function feedToFilters', () => {
  it('should return filters having excluded sources based on advanced settings', async () => {
    loggedUser = '1';
    await saveAdvancedSettingsFiltersFixtures();
    const filters = await feedToFilters(con, '1', '1');
    expect(filters.excludeSources).toEqual([
      'excludedSource',
      'settingsCombinationSource',
    ]);
  });

  it('should return filters having excluded content types based on advanced settings', async () => {
    loggedUser = '1';
    await saveAdvancedSettingsFiltersFixtures();
    const filters = await feedToFilters(con, '1', '1');
    expect(filters.excludeTypes).toEqual(['video:youtube']);
  });

  it('should return filters for tags/sources based on the values from our data', async () => {
    loggedUser = '1';
    await saveFeedFixtures();
    expect(await feedToFilters(con, '1', '1')).toMatchSnapshot();
  });

  it('should return filters with source memberships', async () => {
    loggedUser = '1';
    await saveFixtures(con, User, [usersFixture[0]]);
    await con.getRepository(SourceMember).save([
      {
        userId: '1',
        sourceId: 'a',
        role: SourceMemberRoles.Member,
        referralToken: 'rt',
      },
      {
        userId: '1',
        sourceId: 'b',
        role: SourceMemberRoles.Admin,
        referralToken: 'rt2',
      },
    ]);
    expect(await feedToFilters(con, '1', '1')).toMatchSnapshot();
  });

  it('should not return source in sourceIds if member set hideFeedPosts to true', async () => {
    loggedUser = '1';
    await con.getRepository(User).save(usersFixture[0]);
    await saveFixtures(con, Feed, [{ id: '1', userId: '1' }]);
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad, private: true });
    await con.getRepository(SourceMember).save([
      {
        userId: '1',
        sourceId: 'a',
        role: SourceMemberRoles.Member,
        referralToken: 'rt2',
        createdAt: new Date(2022, 11, 19),
        flags: { hideFeedPosts: true },
      },
    ]);
    const filters = await feedToFilters(con, '1', '1');
    expect(filters.sourceIds).not.toContain('a');
  });

  it('should return source in sourceIds if member set hideFeedPosts to false', async () => {
    loggedUser = '1';
    await con.getRepository(User).save(usersFixture[0]);
    await saveFixtures(con, Feed, [{ id: '1', userId: '1' }]);
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad, private: true });
    await con.getRepository(SourceMember).save([
      {
        userId: '1',
        sourceId: 'a',
        role: SourceMemberRoles.Member,
        referralToken: 'rt2',
        createdAt: new Date(2022, 11, 19),
        flags: { hideFeedPosts: false },
      },
    ]);
    const filters = await feedToFilters(con, '1', '1');
    expect(filters.sourceIds).toContain('a');
  });

  it('should return source in sourceIds if hideFeedPosts is not set', async () => {
    loggedUser = '1';
    await con.getRepository(User).save(usersFixture[0]);
    await saveFixtures(con, Feed, [{ id: '1', userId: '1' }]);
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad, private: true });
    await con.getRepository(SourceMember).save([
      {
        userId: '1',
        sourceId: 'a',
        role: SourceMemberRoles.Member,
        referralToken: 'rt2',
        createdAt: new Date(2022, 11, 19),
        flags: {},
      },
    ]);
    const filters = await feedToFilters(con, '1', '1');
    expect(filters.sourceIds).toContain('a');
  });
});

describe('query feedPreview', () => {
  const QUERY = `
  query FeedPreview($supportedTypes: [String!]) {
    feedPreview(supportedTypes: $supportedTypes) {
      ${feedFields()}
    }
  }
`;

  it('should not authorize when not logged-in', () =>
    testQueryErrorCode(
      client,
      { query: QUERY, variables: {} },
      'UNAUTHENTICATED',
    ));

  it('should return feed', async () => {
    loggedUser = '1';

    await saveFixtures(con, Feed, [{ id: '1', userId: '1' }]);
    await saveFixtures(con, FeedTag, [{ feedId: '1', tag: 'html' }]);
    nock('http://localhost:6000')
      .post('/feed.json', {
        feed_config_name: 'onboarding',
        total_pages: 1,
        page_size: 21,
        offset: 0,
        fresh_page_size: '7',
        user_id: '1',
        allowed_tags: ['html'],
      })
      .reply(200, {
        data: [{ post_id: 'p1' }, { post_id: 'p4' }],
      });

    const res = await client.query(QUERY, { variables: {} });

    expect(res.errors).toBeFalsy();
    expect(res.data.feedPreview.edges.length).toEqual(2);
  });
});
