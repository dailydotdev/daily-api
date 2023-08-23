import {
  CachedFeedClient,
  FeedClient,
  FeedConfig,
  FeedConfigName,
  FeedPreferencesConfigGenerator,
  FeedResponse,
  IFeedClient,
} from '../../src/integrations/feed';
import { MockContext, saveFixtures } from '../helpers';
import { deleteKeysByPattern, ioRedisPool } from '../../src/redis';
import createOrGetConnection from '../../src/db';
import { DataSource } from 'typeorm';
import { Context } from '../../src/Context';
import nock from 'nock';
import { mock } from 'jest-mock-extended';
import {
  Feed,
  FeedSource,
  FeedTag,
  Source,
  SourceMember,
  User,
} from '../../src/entity';
import { SourceMemberRoles } from '../../src/roles';
import { sourcesFixture } from '../fixture/source';
import { usersFixture } from '../fixture/user';

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
const feedResponse: FeedResponse = [
  ['1', '{"p":"a"}'],
  ['2', '{"p":"b"}'],
  ['3', '{"p":"c"}'],
  ['4', null],
  ['5', null],
  ['6', null],
];

const setCache = (
  key: string,
  ids: string[] | [string, string | undefined][],
) =>
  ioRedisPool.execute(async (client) => {
    return client.set(`${key}:posts`, JSON.stringify(ids));
  });

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

describe('CachedFeedClient', () => {
  it('should fetch subsequent pages from cache', async () => {
    const mockClient = mock<IFeedClient>();
    mockClient.fetchFeed.mockResolvedValueOnce(feedResponse);
    const feedClient = new CachedFeedClient(mockClient, ioRedisPool);
    const page0 = await feedClient.fetchFeed(ctx, 'id', config);
    expect(page0).toEqual(feedResponse.slice(0, 2));
    await new Promise(process.nextTick);
    const page1 = await feedClient.fetchFeed(ctx, 'id', {
      ...config,
      offset: 2,
    });
    expect(page1).toEqual(feedResponse.slice(2, 4));
  });

  it('should fetch from origin when cache is old', async () => {
    const mockClient = mock<IFeedClient>();
    mockClient.fetchFeed.mockResolvedValueOnce(feedResponse);
    const feedClient = new CachedFeedClient(mockClient, ioRedisPool);

    const feedId = 'f1';
    const key = feedClient.getCacheKey(config.user_id, feedId);
    await ioRedisPool.execute(async (client) => {
      return client.set(
        `${key}:time`,
        new Date(new Date().getTime() - 60 * 60 * 1000).toISOString(),
      );
    });
    await setCache(key, ['7', '8']);

    const page0 = await feedClient.fetchFeed(ctx, feedId, config);
    expect(page0).toEqual(feedResponse.slice(0, 2));
  });

  it('should fetch from cache when it is still fresh', async () => {
    const mockClient = mock<IFeedClient>();
    const feedClient = new CachedFeedClient(mockClient, ioRedisPool);

    const feedId = 'f2';
    const key = feedClient.getCacheKey(config.user_id, feedId);
    await ioRedisPool.execute(async (client) => {
      return client.set(`${key}:time`, new Date().toISOString());
    });
    await setCache(key, [
      ['7', JSON.stringify({ p: 'a' })],
      ['8', JSON.stringify({ p: 'b' })],
    ]);

    const page0 = await feedClient.fetchFeed(ctx, feedId, config);
    expect(page0).toEqual([
      ['7', JSON.stringify({ p: 'a' })],
      ['8', JSON.stringify({ p: 'b' })],
    ]);
  });

  it('should fetch from origin when last updated time is greater than last generated', async () => {
    const mockClient = mock<IFeedClient>();
    mockClient.fetchFeed.mockResolvedValueOnce(feedResponse);
    const feedClient = new CachedFeedClient(mockClient, ioRedisPool);

    const feedId = 'f3';
    const key = feedClient.getCacheKey(config.user_id, feedId);
    await ioRedisPool.execute(async (client) => {
      return client.set(
        `${feedClient.getCacheKeyPrefix(feedId)}:update`,
        new Date(new Date().getTime() - 10 * 1000).toISOString(),
      );
    });
    await ioRedisPool.execute(async (client) => {
      return client.set(
        `${key}:time`,
        new Date(new Date().getTime() - 60 * 1000).toISOString(),
      );
    });
    await setCache(key, ['7', '8']);

    const page0 = await feedClient.fetchFeed(ctx, feedId, config);
    expect(page0).toEqual(feedResponse.slice(0, 2));
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
  });

  it('should generate feed config with feed preferences', async () => {
    const generator = new FeedPreferencesConfigGenerator(config, {
      includeSourceMemberships: true,
      includeBlockedSources: true,
      includeBlockedTags: true,
      includeAllowedTags: true,
    });

    const actual = await generator.generate(ctx, '1', 2, 3);
    expect(actual).toEqual({
      allowed_tags: ['javascript', 'golang'],
      blocked_sources: ['a', 'b'],
      blocked_tags: ['python', 'java'],
      feed_config_name: FeedConfigName.Personalise,
      fresh_page_size: '1',
      offset: 3,
      page_size: 2,
      squad_ids: ['a', 'b'],
      total_pages: 20,
      user_id: '1',
    });
  });

  it('should generate feed config with blocked tags and sources', async () => {
    const generator = new FeedPreferencesConfigGenerator(config, {
      includeBlockedSources: true,
      includeBlockedTags: true,
    });

    const actual = await generator.generate(ctx, '1', 2, 3);
    expect(actual).toEqual({
      blocked_sources: ['a', 'b'],
      blocked_tags: ['python', 'java'],
      feed_config_name: FeedConfigName.Personalise,
      fresh_page_size: '1',
      offset: 3,
      page_size: 2,
      total_pages: 20,
      user_id: '1',
    });
  });

  it('should generate feed config with no preferences', async () => {
    const generator = new FeedPreferencesConfigGenerator(config);

    const actual = await generator.generate(ctx, '1', 2, 3);
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
