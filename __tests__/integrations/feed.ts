import {
  FeedClient,
  FeedConfig,
  FeedConfigGenerator,
  FeedConfigName,
  FeedPreferencesConfigGenerator,
  FeedResponse,
} from '../../src/integrations/feed';
import {
  connectionFromNodes,
  feedCursorPageGenerator,
} from '../../src/schema/common';
import { MockContext, saveFixtures } from '../helpers';
import { deleteKeysByPattern } from '../../src/redis';
import createOrGetConnection from '../../src/db';
import { DataSource } from 'typeorm';
import { Context } from '../../src/Context';
import nock from 'nock';
import { mock } from 'jest-mock-extended';
import {
  AdvancedSettings,
  Feed,
  FeedAdvancedSettings,
  Keyword,
  PostType,
  postTypes,
  Source,
  SourceMember,
  User,
} from '../../src/entity';
import { SourceMemberRoles } from '../../src/roles';
import { sourcesFixture } from '../fixture/source';
import { userCreatedDate, usersFixture } from '../fixture/user';
import { FeedLofnConfigGenerator } from '../../src/integrations/feed/configs';
import { ILofnClient } from '../../src/integrations/lofn';
import { ContentPreferenceSource } from '../../src/entity/contentPreference/ContentPreferenceSource';
import { ContentPreferenceKeyword } from '../../src/entity/contentPreference/ContentPreferenceKeyword';
import { ContentPreferenceStatus } from '../../src/entity/contentPreference/types';
import { ContentPreferenceWord } from '../../src/entity/contentPreference/ContentPreferenceWord';
import { ContentPreferenceUser } from '../../src/entity/contentPreference/ContentPreferenceUser';

let con: DataSource;
let ctx: Context;

const url = 'http://localhost:3000/feed.json';
const config: FeedConfig = {
  page_size: 2,
  offset: 0,
  user_id: '1',
  feed_config_name: FeedConfigName.Personalise,
  total_pages: 20,
};

const rawFeedResponse = {
  data: [
    { post_id: '1', metadata: { p: 'a' } },
    { post_id: '2', metadata: { p: 'b' } },
    { post_id: '3', metadata: { p: 'c' } },
    { post_id: '4' },
    { post_id: '5' },
    { post_id: '6' },
  ],
};
const feedResponse: FeedResponse = {
  data: [
    ['1', '{"p":"a"}'],
    ['2', '{"p":"b"}'],
    ['3', '{"p":"c"}'],
    ['4', null],
    ['5', null],
    ['6', null],
  ],
};

beforeAll(async () => {
  con = await createOrGetConnection();
  ctx = new MockContext(con);
});

beforeEach(async () => {
  jest.clearAllMocks();
  nock.cleanAll();
  await deleteKeysByPattern('feeds:*');
  await saveFixtures(con, User, [
    usersFixture[0],
    {
      id: 'u1',
      bio: null,
      github: 'user1',
      hashnode: null,
      name: 'User 1',
      image: 'https://daily.dev/user1.jpg',
      email: 'user1@daily.dev',
      createdAt: new Date(userCreatedDate),
      twitter: null,
      username: 'user1',
      infoConfirmed: true,
    },
  ]);
});

describe('FeedClient', () => {
  it('should parse feed service response', async () => {
    nock(url)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .post('', config as any)
      .reply(200, rawFeedResponse);

    const feedClient = new FeedClient(url);
    const feed = await feedClient.fetchFeed(ctx, 'id', config);
    expect(feed).toEqual(feedResponse);
  });

  it('should merge tyr metadata with feed metadata', async () => {
    nock(url)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .post('', config as any)
      .reply(200, rawFeedResponse);

    const feedClient = new FeedClient(url);
    const feed = await feedClient.fetchFeed(ctx, 'id', config, {
      mab: { test: 'da' },
    });
    expect(feed).toEqual({
      data: [
        ['1', '{"p":"a","mab":{"test":"da"}}'],
        ['2', '{"p":"b","mab":{"test":"da"}}'],
        ['3', '{"p":"c","mab":{"test":"da"}}'],
        ['4', '{"mab":{"test":"da"}}'],
        ['5', '{"mab":{"test":"da"}}'],
        ['6', '{"mab":{"test":"da"}}'],
      ],
    });
  });

  it('should parse staleCursor from feed service response', async () => {
    const responseWithStaleCursor = {
      ...rawFeedResponse,
      cursor: 'abc123',
      stale_cursor: true,
    };

    nock(url)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .post('', config as any)
      .reply(200, responseWithStaleCursor);

    const feedClient = new FeedClient(url);
    const feed = await feedClient.fetchFeed(ctx, 'id', config);
    expect(feed).toMatchObject({
      cursor: 'abc123',
      staleCursor: true,
    });
  });

  it('should not include staleCursor when not present in response', async () => {
    nock(url)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .post('', config as any)
      .reply(200, rawFeedResponse);

    const feedClient = new FeedClient(url);
    const feed = await feedClient.fetchFeed(ctx, 'id', config);
    expect(feed.staleCursor).toBeUndefined();
  });
});

describe('connectionFromNodes with staleCursor', () => {
  const pageGenerator = feedCursorPageGenerator<{ id: string }>(30, 50);

  it('should include staleCursor in pageInfo when present in queryParams', () => {
    const nodes = [{ id: '1' }, { id: '2' }];
    const page = { limit: 30 };
    const queryParams: FeedResponse = {
      data: [
        ['1', null],
        ['2', null],
      ],
      cursor: 'next-cursor',
      staleCursor: true,
    };

    const result = connectionFromNodes(
      {},
      nodes,
      undefined,
      page,
      pageGenerator,
      undefined,
      queryParams,
    );

    expect(result.pageInfo.staleCursor).toBe(true);
  });

  it('should have undefined staleCursor in pageInfo when not present in queryParams', () => {
    const nodes = [{ id: '1' }, { id: '2' }];
    const page = { limit: 30 };
    const queryParams: FeedResponse = {
      data: [
        ['1', null],
        ['2', null],
      ],
      cursor: 'next-cursor',
    };

    const result = connectionFromNodes(
      {},
      nodes,
      undefined,
      page,
      pageGenerator,
      undefined,
      queryParams,
    );

    expect(result.pageInfo.staleCursor).toBeUndefined();
  });

  it('should include staleCursor in pageInfo even when nodes are empty', () => {
    const nodes: { id: string }[] = [];
    const page = { limit: 30 };
    const queryParams: FeedResponse = {
      data: [],
      staleCursor: true,
    };

    const result = connectionFromNodes(
      {},
      nodes,
      undefined,
      page,
      pageGenerator,
      undefined,
      queryParams,
    );

    expect(result.pageInfo.staleCursor).toBe(true);
    expect(result.edges).toHaveLength(0);
  });
});

describe('FeedPreferencesConfigGenerator', () => {
  beforeEach(async () => {
    await saveFixtures(con, Source, sourcesFixture);
    await saveFixtures(con, Keyword, [
      {
        value: 'javascript',
        status: 'allow',
      },
      {
        value: 'golang',
        status: 'allow',
      },
      {
        value: 'python',
        status: 'allow',
      },
      {
        value: 'java',
        status: 'allow',
      },
    ]);
    await con.getRepository(Feed).save({ id: '1', userId: 'u1' });
    await con.getRepository(ContentPreferenceKeyword).save([
      {
        feedId: '1',
        keywordId: 'javascript',
        userId: '1',
        referenceId: 'javascript',
        status: ContentPreferenceStatus.Follow,
      },
      {
        feedId: '1',
        keywordId: 'golang',
        userId: '1',
        referenceId: 'golang',
        status: ContentPreferenceStatus.Follow,
      },
      {
        feedId: '1',
        keywordId: 'python',
        userId: '1',
        referenceId: 'python',
        status: ContentPreferenceStatus.Blocked,
      },
      {
        feedId: '1',
        keywordId: 'java',
        userId: '1',
        referenceId: 'java',
        status: ContentPreferenceStatus.Blocked,
      },
    ]);
    await con.getRepository(ContentPreferenceWord).save([
      {
        feedId: '1',
        userId: '1',
        referenceId: 'word-abc',
        status: ContentPreferenceStatus.Blocked,
      },
      {
        feedId: '1',
        userId: '1',
        referenceId: 'word-def',
        status: ContentPreferenceStatus.Blocked,
      },
    ]);
    await con.getRepository(ContentPreferenceSource).save([
      {
        feedId: '1',
        sourceId: 'c',
        userId: '1',
        status: ContentPreferenceStatus.Follow,
        referenceId: 'c',
      },
      {
        feedId: '1',
        sourceId: 'p',
        userId: '1',
        status: ContentPreferenceStatus.Subscribed,
        referenceId: 'd',
      },
    ]);
    await con.getRepository(ContentPreferenceUser).save([
      {
        feedId: '1',
        userId: '1',
        status: ContentPreferenceStatus.Follow,
        referenceId: '2',
      },
      {
        feedId: '1',
        userId: '1',
        status: ContentPreferenceStatus.Subscribed,
        referenceId: '3',
      },
      {
        feedId: '1',
        userId: '1',
        status: ContentPreferenceStatus.Blocked,
        referenceId: '4',
      },
    ]);
    await con.getRepository(ContentPreferenceSource).save([
      {
        feedId: '1',
        sourceId: 'a',
        userId: '1',
        status: ContentPreferenceStatus.Blocked,
        referenceId: 'a',
      },
      {
        feedId: '1',
        sourceId: 'b',
        userId: '1',
        status: ContentPreferenceStatus.Blocked,
        referenceId: 'b',
      },
    ]);
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
    await con.getRepository(AdvancedSettings).save([
      {
        title: 'Videos',
        group: 'content_types',
        description: '',
        defaultEnabledState: true,
        options: { type: PostType.VideoYouTube },
      },
      {
        title: 'Articles',
        group: 'content_types',
        description: '',
        defaultEnabledState: true,
        options: { type: PostType.Article },
      },
      {
        title: 'News',
        group: 'content_curation',
        description: '',
        defaultEnabledState: true,
        options: { type: 'news' },
      },
    ]);
    await con.getRepository(FeedAdvancedSettings).save([
      { feedId: '1', advancedSettingsId: 1, enabled: false },
      { feedId: '1', advancedSettingsId: 2, enabled: true },
    ]);
  });

  it('should generate feed config with feed preferences', async () => {
    const generator: FeedConfigGenerator = new FeedPreferencesConfigGenerator(
      config,
      {
        includeSourceMemberships: true,
        includeBlockedSources: true,
        includeBlockedTags: true,
        includeAllowedTags: true,
        includePostTypes: true,
        includeBlockedWords: true,
        includeFollowedUsers: true,
        includeFollowedSources: true,
        includeBlockedUsers: true,
      },
    );

    const actual = await generator.generate(ctx, {
      user_id: '1',
      page_size: 2,
      offset: 3,
    });
    expect(actual).toEqual({
      config: {
        allowed_tags: expect.arrayContaining(['javascript', 'golang']),
        blocked_sources: expect.arrayContaining(['a', 'b']),
        blocked_tags: expect.arrayContaining(['python', 'java']),
        blocked_title_words: expect.arrayContaining(['word-abc', 'word-def']),
        blocked_author_ids: expect.arrayContaining(['4']),
        followed_sources: expect.arrayContaining(['c', 'p']),
        followed_user_ids: expect.arrayContaining(['2', '3']),
        allowed_post_types: postTypes.filter(
          (x) => x !== PostType.VideoYouTube,
        ),
        feed_config_name: FeedConfigName.Personalise,
        fresh_page_size: '1',
        offset: 3,
        page_size: 2,
        squad_ids: expect.arrayContaining(['a', 'b']),
        total_pages: 20,
        user_id: '1',
      },
    });
  });

  it('should generate feed config with blocked content curation', async () => {
    await con
      .getRepository(FeedAdvancedSettings)
      .save([{ feedId: '1', advancedSettingsId: 3, enabled: false }]);
    const generator: FeedConfigGenerator = new FeedPreferencesConfigGenerator(
      config,
      {
        includeContentCuration: true,
      },
    );

    const actual = await generator.generate(ctx, {
      user_id: '1',
      page_size: 2,
      offset: 3,
    });
    expect(actual).toEqual({
      config: {
        allowed_content_curations: [
          'release',
          'opinion',
          'listicle',
          'comparison',
          'tutorial',
          'story',
          'meme',
          'drama',
          'endorsement',
          'criticism',
          'leak',
          'milestone',
          'hot_take',
        ],
        feed_config_name: FeedConfigName.Personalise,
        fresh_page_size: '1',
        offset: 3,
        page_size: 2,
        total_pages: 20,
        user_id: '1',
      },
    });
  });

  it('should generate feed config with blocked tags and sources', async () => {
    const generator: FeedConfigGenerator = new FeedPreferencesConfigGenerator(
      config,
      {
        includeBlockedSources: true,
        includeBlockedTags: true,
      },
    );

    const actual = await generator.generate(ctx, {
      user_id: '1',
      page_size: 2,
      offset: 3,
    });
    expect(actual).toEqual({
      config: {
        blocked_sources: expect.arrayContaining(['a', 'b']),
        blocked_tags: expect.arrayContaining(['python', 'java']),
        feed_config_name: FeedConfigName.Personalise,
        fresh_page_size: '1',
        offset: 3,
        page_size: 2,
        total_pages: 20,
        user_id: '1',
      },
    });
  });

  it('should generate feed config with no preferences', async () => {
    const generator: FeedConfigGenerator = new FeedPreferencesConfigGenerator(
      config,
    );

    const actual = await generator.generate(ctx, {
      user_id: '1',
      page_size: 2,
      offset: 3,
    });
    expect(actual).toEqual({
      config: {
        feed_config_name: FeedConfigName.Personalise,
        fresh_page_size: '1',
        offset: 3,
        page_size: 2,
        total_pages: 20,
        user_id: '1',
      },
    });
  });

  it('should generate feed config with feedId passed to opts', async () => {
    const generator: FeedConfigGenerator = new FeedPreferencesConfigGenerator(
      config,
      {
        feedId: 'cf1',
        includeAllowedTags: true,
      },
    );
    await con.getRepository(Feed).save({ id: 'cf1', userId: 'u1' });
    await con.getRepository(ContentPreferenceKeyword).save([
      {
        feedId: 'cf1',
        keywordId: 'javascript',
        userId: '1',
        referenceId: 'javascript',
        status: ContentPreferenceStatus.Follow,
      },
      {
        feedId: 'cf1',
        keywordId: 'golang',
        userId: '1',
        referenceId: 'golang',
        status: ContentPreferenceStatus.Follow,
      },
      {
        feedId: 'cf1',
        keywordId: 'python',
        userId: '1',
        referenceId: 'python',
        status: ContentPreferenceStatus.Follow,
      },
      {
        feedId: 'cf1',
        keywordId: 'java',
        userId: '1',
        referenceId: 'java',
        status: ContentPreferenceStatus.Follow,
      },
    ]);

    const actual = await generator.generate(ctx, {
      user_id: '1',
      page_size: 2,
      offset: 3,
    });
    expect(actual).toEqual({
      config: {
        feed_config_name: FeedConfigName.Personalise,
        fresh_page_size: '1',
        offset: 3,
        page_size: 2,
        total_pages: 20,
        user_id: '1',
        allowed_tags: expect.arrayContaining(['python', 'java']),
      },
    });
  });
});

describe('FeedLofnConfigGenerator', () => {
  beforeEach(async () => {
    await saveFixtures(con, Source, sourcesFixture);
    await con.getRepository(Feed).save({ id: '1', userId: 'u1' });
    await saveFixtures(con, Keyword, [
      {
        value: 'javascript',
        status: 'allow',
      },
      {
        value: 'golang',
        status: 'allow',
      },
      {
        value: 'python',
        status: 'allow',
      },
      {
        value: 'java',
        status: 'allow',
      },
    ]);
    await con.getRepository(ContentPreferenceKeyword).save([
      {
        feedId: '1',
        keywordId: 'javascript',
        userId: '1',
        referenceId: 'javascript',
        status: ContentPreferenceStatus.Follow,
      },
      {
        feedId: '1',
        keywordId: 'golang',
        userId: '1',
        referenceId: 'golang',
        status: ContentPreferenceStatus.Follow,
      },
      {
        feedId: '1',
        keywordId: 'python',
        userId: '1',
        referenceId: 'python',
        status: ContentPreferenceStatus.Blocked,
      },
      {
        feedId: '1',
        keywordId: 'java',
        userId: '1',
        referenceId: 'java',
        status: ContentPreferenceStatus.Blocked,
      },
    ]);
    await con.getRepository(ContentPreferenceWord).save([
      {
        feedId: '1',
        userId: '1',
        referenceId: 'word-abc',
        status: ContentPreferenceStatus.Blocked,
      },
      {
        feedId: '1',
        userId: '1',
        referenceId: 'word-def',
        status: ContentPreferenceStatus.Blocked,
      },
    ]);
    await con.getRepository(ContentPreferenceSource).save([
      {
        feedId: '1',
        sourceId: 'a',
        userId: '1',
        status: ContentPreferenceStatus.Blocked,
        referenceId: 'a',
      },
      {
        feedId: '1',
        sourceId: 'b',
        userId: '1',
        status: ContentPreferenceStatus.Blocked,
        referenceId: 'b',
      },
    ]);
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
    await con.getRepository(AdvancedSettings).save([
      {
        title: 'Videos',
        group: 'content_types',
        description: '',
        defaultEnabledState: true,
        options: { type: PostType.VideoYouTube },
      },
      {
        title: 'Articles',
        group: 'content_types',
        description: '',
        defaultEnabledState: true,
        options: { type: PostType.Article },
      },
    ]);
    await con.getRepository(FeedAdvancedSettings).save([
      { feedId: '1', advancedSettingsId: 1, enabled: false },
      { feedId: '1', advancedSettingsId: 2, enabled: true },
    ]);
  });

  it('should generate config through lofn', async () => {
    const mockClient = mock<ILofnClient>();
    const mockedValue = {
      user_id: '1',
      config: {
        providers: {},
      },
      tyr_metadata: {
        test: 'da',
      },
    };
    mockClient.fetchConfig.mockResolvedValueOnce(mockedValue);
    const generator: FeedConfigGenerator = new FeedLofnConfigGenerator(
      {
        total_pages: 1,
      },
      mockClient,
      {
        includeBlockedTags: true,
        includeAllowedTags: true,
        includeBlockedSources: true,
        includeSourceMemberships: true,
        includePostTypes: true,
        includeBlockedWords: true,
        feed_version: '30',
      },
    );
    const actual = await generator.generate(ctx, {
      user_id: '1',
      page_size: 10,
      offset: 3,
      cursor: 'cursor-1',
    });

    expect(mockClient.fetchConfig).toHaveBeenCalledTimes(1);
    expect(mockClient.fetchConfig).toHaveBeenCalledWith({
      user_id: '1',
      feed_version: '30',
      cursor: 'cursor-1',
    });

    expect(actual).toMatchObject({
      config: {
        user_id: '1',
        total_pages: 1,
        page_size: 10,
        fresh_page_size: '4',
        allowed_tags: expect.arrayContaining(['javascript', 'golang']),
        blocked_tags: expect.arrayContaining(['python', 'java']),
        blocked_title_words: expect.arrayContaining(['word-abc', 'word-def']),
        blocked_sources: expect.arrayContaining(['a', 'b']),
        squad_ids: expect.arrayContaining(['a', 'b']),
        allowed_post_types: expect.arrayContaining([
          'article',
          'share',
          'freeform',
          'welcome',
          'collection',
        ]),
        config: {
          providers: {},
        },
      },
      extraMetadata: {
        mab: mockedValue.tyr_metadata,
      },
    });
  });

  it('should generate config through lofn and include extra in the request', async () => {
    const mockClient = mock<ILofnClient>();
    const mockedValue = {
      user_id: '1',
      config: {
        providers: {},
      },
      tyr_metadata: {
        test: 'da',
      },
      extra: {
        aigc_threshold: 'none',
      },
    };
    mockClient.fetchConfig.mockResolvedValueOnce(mockedValue);
    const generator: FeedConfigGenerator = new FeedLofnConfigGenerator(
      {
        total_pages: 1,
      },
      mockClient,
      {
        feed_version: '30',
      },
    );
    const actual = await generator.generate(ctx, {
      user_id: '1',
      page_size: 10,
      offset: 3,
    });
    expect(actual).toMatchObject({
      config: {
        user_id: '1',
        total_pages: 1,
        page_size: 10,
        fresh_page_size: '4',
        aigc_threshold: 'none',
        config: {
          providers: {},
        },
      },
      extraMetadata: {
        mab: mockedValue.tyr_metadata,
      },
    });
  });
});
