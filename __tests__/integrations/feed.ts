import {
  FeedClient,
  FeedConfig,
  FeedConfigGenerator,
  FeedConfigName,
  FeedPreferencesConfigGenerator,
  FeedResponse,
  SimpleFeedConfigGenerator,
} from '../../src/integrations/feed';
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
  FeedSource,
  FeedTag,
  PostType,
  postTypes,
  Source,
  SourceMember,
  User,
} from '../../src/entity';
import { SourceMemberRoles } from '../../src/roles';
import { sourcesFixture } from '../fixture/source';
import { userCreatedDate, usersFixture } from '../fixture/user';
import {
  ISnotraClient,
  SnotraClient,
  UserState,
} from '../../src/integrations/snotra';
import {
  FeedLofnConfigGenerator,
  FeedUserStateConfigGenerator,
} from '../../src/integrations/feed/configs';
import { ILofnClient } from '../../src/integrations/lofn';
import { WATERCOOLER_ID } from '../../src/common';

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
});

describe('FeedPreferencesConfigGenerator', () => {
  beforeEach(async () => {
    await saveFixtures(con, Source, sourcesFixture);
    await con.getRepository(Feed).save({ id: '1', userId: 'u1' });
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

  it('should generate feed config with feed preferences', async () => {
    const generator: FeedConfigGenerator = new FeedPreferencesConfigGenerator(
      config,
      {
        includeSourceMemberships: true,
        includeBlockedSources: true,
        includeBlockedTags: true,
        includeAllowedTags: true,
        includePostTypes: true,
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
    await con.getRepository(FeedTag).save([
      { feedId: 'cf1', tag: 'javascript' },
      { feedId: 'cf1', tag: 'golang' },
      { feedId: 'cf1', tag: 'python' },
      { feedId: 'cf1', tag: 'java' },
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

describe('FeedUserStateConfigGenerator', () => {
  const generators: Record<UserState, FeedConfigGenerator> = {
    personalised: new SimpleFeedConfigGenerator({
      feed_config_name: FeedConfigName.Vector,
    }),
    non_personalised: new SimpleFeedConfigGenerator({
      feed_config_name: FeedConfigName.Personalise,
    }),
  };

  it('should generate config based on user state', async () => {
    const mockClient = mock<ISnotraClient>();
    mockClient.fetchUserState.mockResolvedValueOnce({
      personalise: { state: 'personalised' },
    });
    const generator: FeedConfigGenerator = new FeedUserStateConfigGenerator(
      mockClient,
      generators,
    );
    const actual = await generator.generate(ctx, {
      user_id: '1',
      page_size: 2,
      offset: 3,
    });
    expect(actual.config).toBeTruthy();
    expect(actual.config.user_id).toEqual('1');
    expect(actual.config.feed_config_name).toEqual('vector');
    expect(mockClient.fetchUserState).toBeCalledWith({
      user_id: '1',
      providers: { personalise: {} },
    });
  });

  it('should generate config based on user state', async () => {
    const mockClient = mock<ISnotraClient>();
    mockClient.fetchUserState.mockResolvedValueOnce({
      personalise: { state: 'non_personalised' },
    });
    const generator: FeedConfigGenerator = new FeedUserStateConfigGenerator(
      mockClient,
      generators,
    );
    const actual = await generator.generate(ctx, {
      user_id: '1',
      page_size: 2,
      offset: 3,
    });
    expect(actual.config.feed_config_name).toEqual('personalise');
  });

  it('should send proper parameters to snotra', async () => {
    const client = new SnotraClient();
    nock('http://localhost:6001')
      .post('/api/v1/user/profile', {
        user_id: '1',
        providers: {
          personalise: {},
        },
        post_rank_count: 8,
      })
      .reply(200, { personalise: { state: 'personalised' } });
    const generator: FeedConfigGenerator = new FeedUserStateConfigGenerator(
      client,
      generators,
      8,
    );
    await generator.generate(ctx, {
      user_id: '1',
      page_size: 2,
      offset: 3,
    });
  });
});

describe('FeedLofnConfigGenerator', () => {
  beforeEach(async () => {
    await saveFixtures(con, Source, sourcesFixture);
    await con.getRepository(Feed).save({ id: '1', userId: 'u1' });
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
        page_size: 20,
        total_pages: 10,
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
        allowed_tags: ['javascript', 'golang'],
        blocked_tags: ['python', 'java'],
        blocked_sources: ['a', 'b', WATERCOOLER_ID],
        squad_ids: ['a', 'b'],
        allowed_post_types: [
          'article',
          'share',
          'freeform',
          'welcome',
          'collection',
        ],
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
        page_size: 20,
        total_pages: 10,
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
