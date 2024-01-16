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
import { usersFixture } from '../fixture/user';
import { ISnotraClient, UserState } from '../../src/integrations/snotra';
import { FeedUserStateConfigGenerator } from '../../src/integrations/feed/configs';

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
});

describe('FeedPreferencesConfigGenerator', () => {
  beforeEach(async () => {
    await saveFixtures(con, Source, sourcesFixture);
    await saveFixtures(con, User, [usersFixture[0]]);
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
      allowed_tags: expect.arrayContaining(['javascript', 'golang']),
      blocked_sources: expect.arrayContaining(['a', 'b']),
      blocked_tags: expect.arrayContaining(['python', 'java']),
      allowed_post_types: postTypes.filter((x) => x !== PostType.VideoYouTube),
      feed_config_name: FeedConfigName.Personalise,
      fresh_page_size: '1',
      offset: 3,
      page_size: 2,
      squad_ids: expect.arrayContaining(['a', 'b']),
      total_pages: 20,
      user_id: '1',
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
      blocked_sources: expect.arrayContaining(['a', 'b']),
      blocked_tags: expect.arrayContaining(['python', 'java']),
      feed_config_name: FeedConfigName.Personalise,
      fresh_page_size: '1',
      offset: 3,
      page_size: 2,
      total_pages: 20,
      user_id: '1',
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
      feed_config_name: FeedConfigName.Personalise,
      fresh_page_size: '1',
      offset: 3,
      page_size: 2,
      total_pages: 20,
      user_id: '1',
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
    expect(actual.user_id).toEqual('1');
    expect(actual.feed_config_name).toEqual('vector');
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
    expect(actual.feed_config_name).toEqual('personalise');
  });
});
