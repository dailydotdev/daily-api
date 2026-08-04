import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { saveFixtures } from '../helpers';
import { usersFixture } from '../fixture/user';
import { User } from '../../src/entity/user/User';
import { Keyword } from '../../src/entity/Keyword';
import { Feed, FeedOrigin } from '../../src/entity/Feed';
import { FeedTag } from '../../src/entity/FeedTag';
import { ContentPreferenceKeyword } from '../../src/entity/contentPreference/ContentPreferenceKeyword';
import {
  ContentPreferenceStatus,
  ContentPreferenceType,
} from '../../src/entity/contentPreference/types';
import { feedClient } from '../../src/integrations/feed/generators';
import { seedTagChipFeedsIfNeeded } from '../../src/common/seedTagChipFeeds';
import { TagChipSeedStrategy } from '../../src/types';
import { remoteConfig } from '../../src/remoteConfig';

jest.mock('../../src/integrations/feed/generators', () => ({
  ...jest.requireActual('../../src/integrations/feed/generators'),
  feedClient: {
    getUserTags: jest.fn(),
    getTopics: jest.fn(),
  },
}));

const getUserTagsMock = feedClient.getUserTags as jest.MockedFunction<
  typeof feedClient.getUserTags
>;

const getTopicsMock = feedClient.getTopics as jest.MockedFunction<
  typeof feedClient.getTopics
>;

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  getUserTagsMock.mockReset();
  getTopicsMock.mockReset();
  await saveFixtures(con, User, usersFixture);
  // main feed (id === userId) — ContentPreferenceKeyword.feedId FKs to feed.id
  await saveFixtures(con, Feed, [{ id: '1', userId: '1' }]);
  await saveFixtures(con, Keyword, [
    { value: 'javascript', status: 'allow', flags: { title: 'JavaScript' } },
    { value: 'nodejs', status: 'allow', flags: { title: 'Node.js' } },
    { value: 'webdev', status: 'allow' },
  ]);
});

const getChipFeeds = (userId: string) =>
  con
    .getRepository(Feed)
    .createQueryBuilder('feed')
    .where('feed."userId" = :userId', { userId })
    .andWhere(`feed.flags->>'origin' = :origin`, {
      origin: FeedOrigin.TagChip,
    })
    .getMany();

describe('seedTagChipFeedsIfNeeded', () => {
  it('creates one custom feed per feedClient tag with resolved labels', async () => {
    getUserTagsMock.mockResolvedValue(['javascript', 'nodejs']);

    await seedTagChipFeedsIfNeeded({ con, userId: '1', limit: 2 });

    const feeds = await getChipFeeds('1');
    expect(feeds).toHaveLength(2);
    expect(feeds.map((f) => f.flags.name).sort()).toEqual([
      'JavaScript',
      'Node.js',
    ]);

    // each seeded feed has a follow keyword pref + FeedTag
    for (const feed of feeds) {
      const prefs = await con
        .getRepository(ContentPreferenceKeyword)
        .findBy({ feedId: feed.id });
      expect(prefs).toHaveLength(1);
      expect(prefs[0].status).toEqual(ContentPreferenceStatus.Follow);
      const tags = await con.getRepository(FeedTag).findBy({ feedId: feed.id });
      expect(tags).toHaveLength(1);
    }
  });

  it('falls back to the keyword value when no title exists', async () => {
    getUserTagsMock.mockResolvedValue(['webdev']);

    await seedTagChipFeedsIfNeeded({ con, userId: '1', limit: 5 });

    const feeds = await getChipFeeds('1');
    expect(feeds).toHaveLength(1);
    expect(feeds[0].flags.name).toEqual('webdev');
  });

  it('is idempotent — flag-gated so a second call seeds nothing new', async () => {
    getUserTagsMock.mockResolvedValue(['javascript']);

    await seedTagChipFeedsIfNeeded({ con, userId: '1', limit: 5 });
    const firstIds = (await getChipFeeds('1')).map((f) => f.id);

    getUserTagsMock.mockResolvedValue(['javascript', 'nodejs']);
    await seedTagChipFeedsIfNeeded({ con, userId: '1', limit: 5 });
    const secondIds = (await getChipFeeds('1')).map((f) => f.id);

    expect(secondIds).toEqual(firstIds);

    const user = await con.getRepository(User).findOneByOrFail({ id: '1' });
    expect(user.flags?.tagChipFeedsSeededAt).toEqual(expect.any(String));
  });

  it('does not retry even when the previous attempt yielded zero feeds', async () => {
    getUserTagsMock.mockResolvedValue([]);

    await seedTagChipFeedsIfNeeded({ con, userId: '1', limit: 5 });
    expect(await getChipFeeds('1')).toHaveLength(0);

    // a second call must NOT call upstream again — flag is set
    getUserTagsMock.mockClear();
    getUserTagsMock.mockResolvedValue(['javascript']);

    await seedTagChipFeedsIfNeeded({ con, userId: '1', limit: 5 });
    expect(await getChipFeeds('1')).toHaveLength(0);
    expect(getUserTagsMock).not.toHaveBeenCalled();
  });

  it('seeds nothing when feedClient and onboarding follows are both empty', async () => {
    getUserTagsMock.mockResolvedValue([]);

    await seedTagChipFeedsIfNeeded({ con, userId: '1', limit: 5 });

    expect(await getChipFeeds('1')).toHaveLength(0);
  });

  it('falls back to onboarding follows when feedClient returns nothing', async () => {
    getUserTagsMock.mockResolvedValue([]);
    await saveFixtures(con, ContentPreferenceKeyword, [
      {
        feedId: '1',
        keywordId: 'javascript',
        referenceId: 'javascript',
        status: ContentPreferenceStatus.Follow,
        type: ContentPreferenceType.Keyword,
        userId: '1',
      },
      {
        feedId: '1',
        keywordId: 'nodejs',
        referenceId: 'nodejs',
        status: ContentPreferenceStatus.Follow,
        type: ContentPreferenceType.Keyword,
        userId: '1',
      },
      {
        feedId: '1',
        keywordId: 'webdev',
        referenceId: 'webdev',
        status: ContentPreferenceStatus.Blocked,
        type: ContentPreferenceType.Keyword,
        userId: '1',
      },
    ]);

    await seedTagChipFeedsIfNeeded({ con, userId: '1', limit: 5 });

    const feeds = await getChipFeeds('1');
    expect(feeds.map((f) => f.flags.name).sort()).toEqual([
      'JavaScript',
      'Node.js',
    ]);
  });

  it("caps the seed count at the user's remaining feed headroom", async () => {
    // user '1' already has the main feed (id='1') saved in beforeEach.
    // Fill up to maxFeedsPerUser - 2 → 2 slots remaining.
    const fillerFeeds = Array.from({ length: 32 }, (_, i) => ({
      id: `pre-${i}`,
      userId: '1',
      flags: { name: `Pre ${i}` },
    }));
    await con.getRepository(Feed).save(fillerFeeds);

    getUserTagsMock.mockResolvedValue([
      'javascript',
      'nodejs',
      'webdev',
      'rust',
      'golang',
    ]);

    await seedTagChipFeedsIfNeeded({ con, userId: '1', limit: 5 });

    const chipFeeds = await getChipFeeds('1');
    expect(chipFeeds).toHaveLength(2);
    expect(getUserTagsMock).toHaveBeenCalledWith('1', 2);
  });

  it('skips seeding entirely when the user is already at the feed cap', async () => {
    // Fill to exactly maxFeedsPerUser (main feed + 34 = 35).
    const fillerFeeds = Array.from({ length: 34 }, (_, i) => ({
      id: `cap-${i}`,
      userId: '1',
      flags: { name: `Cap ${i}` },
    }));
    await con.getRepository(Feed).save(fillerFeeds);

    getUserTagsMock.mockResolvedValue(['javascript', 'nodejs']);

    await seedTagChipFeedsIfNeeded({ con, userId: '1', limit: 5 });

    expect(await getChipFeeds('1')).toHaveLength(0);
    expect(getUserTagsMock).not.toHaveBeenCalled();

    // flag is still set — bootstrap won't retry on next call.
    const user = await con.getRepository(User).findOneByOrFail({ id: '1' });
    expect(user.flags?.tagChipFeedsSeededAt).toEqual(expect.any(String));
  });

  it('falls back to onboarding follows when feedClient fails', async () => {
    getUserTagsMock.mockRejectedValue(new Error('boom'));
    await saveFixtures(con, ContentPreferenceKeyword, [
      {
        feedId: '1',
        keywordId: 'nodejs',
        referenceId: 'nodejs',
        status: ContentPreferenceStatus.Follow,
        type: ContentPreferenceType.Keyword,
        userId: '1',
      },
    ]);

    await seedTagChipFeedsIfNeeded({ con, userId: '1', limit: 2 });

    const feeds = await getChipFeeds('1');
    expect(feeds.map((f) => f.flags.name)).toEqual(['Node.js']);
  });

  it('records the strategy that seeded the user', async () => {
    getUserTagsMock.mockResolvedValue(['javascript']);

    await seedTagChipFeedsIfNeeded({ con, userId: '1', limit: 2 });

    const user = await con.getRepository(User).findOneByOrFail({ id: '1' });
    expect(user.flags?.tagChipFeedsSeedStrategy).toEqual(
      TagChipSeedStrategy.V1,
    );
  });

  describe('V2 strategy', () => {
    const saveOnboardingFollows = (tags: string[]) =>
      saveFixtures(
        con,
        ContentPreferenceKeyword,
        tags.map((tag) => ({
          feedId: '1',
          keywordId: tag,
          referenceId: tag,
          status: ContentPreferenceStatus.Follow,
          type: ContentPreferenceType.Keyword,
          userId: '1',
        })),
      );

    const seedV2 = (limit = 5) =>
      seedTagChipFeedsIfNeeded({
        con,
        userId: '1',
        limit,
        strategy: TagChipSeedStrategy.V2,
      });

    const getFeedTags = (feedId: string) =>
      con
        .getRepository(FeedTag)
        .find({ where: { feedId }, order: { tag: 'ASC' } });

    beforeEach(() => {
      remoteConfig.vars.tagChipTopicsClusterThreshold = 0.4;
    });

    afterEach(() => {
      remoteConfig.vars.tagChipTopicsClusterThreshold = undefined;
    });

    it('seeds one multi-tag feed per clustered topic', async () => {
      await saveOnboardingFollows(['javascript', 'nodejs', 'webdev']);
      getTopicsMock.mockResolvedValue([
        { label: 'javascript', tags: ['javascript', 'nodejs'] },
        { label: 'webdev', tags: ['webdev'] },
      ]);

      await seedV2();

      const feeds = await getChipFeeds('1');
      expect(feeds.map((f) => f.flags.name).sort()).toEqual([
        'JavaScript',
        'webdev',
      ]);

      const [grouped] = feeds.filter((f) => f.flags.name === 'JavaScript');
      expect((await getFeedTags(grouped.id)).map((t) => t.tag)).toEqual([
        'javascript',
        'nodejs',
      ]);

      const prefs = await con
        .getRepository(ContentPreferenceKeyword)
        .findBy({ feedId: grouped.id });
      expect(prefs.map((p) => p.keywordId).sort()).toEqual([
        'javascript',
        'nodejs',
      ]);
      expect(
        prefs.every((p) => p.status === ContentPreferenceStatus.Follow),
      ).toBe(true);
    });

    it('sends every non-blocked onboarding tag plus the configured threshold', async () => {
      await saveOnboardingFollows(['javascript', 'nodejs']);
      await saveFixtures(con, ContentPreferenceKeyword, [
        {
          feedId: '1',
          keywordId: 'webdev',
          referenceId: 'webdev',
          status: ContentPreferenceStatus.Blocked,
          type: ContentPreferenceType.Keyword,
          userId: '1',
        },
      ]);
      getTopicsMock.mockResolvedValue([
        { label: 'javascript', tags: ['javascript', 'nodejs'] },
      ]);

      await seedV2(2);

      expect(getTopicsMock).toHaveBeenCalledWith(['javascript', 'nodejs'], 0.4);
      expect(getUserTagsMock).not.toHaveBeenCalled();
    });

    it('caps the seeded topics at the limit', async () => {
      await saveOnboardingFollows(['javascript', 'nodejs', 'webdev']);
      getTopicsMock.mockResolvedValue([
        { label: 'javascript', tags: ['javascript'] },
        { label: 'nodejs', tags: ['nodejs'] },
        { label: 'webdev', tags: ['webdev'] },
      ]);

      await seedV2(2);

      expect(await getChipFeeds('1')).toHaveLength(2);
    });

    it('drops topics with duplicate labels or no tags', async () => {
      await saveOnboardingFollows(['javascript', 'nodejs']);
      getTopicsMock.mockResolvedValue([
        { label: 'javascript', tags: ['javascript'] },
        { label: 'javascript', tags: ['nodejs'] },
        { label: 'nodejs', tags: [] },
      ]);

      await seedV2();

      const feeds = await getChipFeeds('1');
      expect(feeds.map((f) => f.flags.name)).toEqual(['JavaScript']);
    });

    it('falls back to the V1 path when clustering fails', async () => {
      await saveOnboardingFollows(['javascript']);
      getTopicsMock.mockRejectedValue(new Error('boom'));
      getUserTagsMock.mockResolvedValue(['nodejs']);

      await seedV2(2);

      const feeds = await getChipFeeds('1');
      expect(feeds.map((f) => f.flags.name)).toEqual(['Node.js']);
      expect(await getFeedTags(feeds[0].id)).toHaveLength(1);
    });

    it('falls back to the V1 path when clustering returns nothing', async () => {
      await saveOnboardingFollows(['javascript']);
      getTopicsMock.mockResolvedValue([]);
      getUserTagsMock.mockResolvedValue(['nodejs']);

      await seedV2(2);

      expect((await getChipFeeds('1')).map((f) => f.flags.name)).toEqual([
        'Node.js',
      ]);
    });

    it('falls back to the V1 path when the user has no onboarding tags', async () => {
      getUserTagsMock.mockResolvedValue(['javascript']);

      await seedV2(2);

      expect(getTopicsMock).not.toHaveBeenCalled();
      expect((await getChipFeeds('1')).map((f) => f.flags.name)).toEqual([
        'JavaScript',
      ]);
    });

    it('records the V2 strategy on the user', async () => {
      await saveOnboardingFollows(['javascript']);
      getTopicsMock.mockResolvedValue([
        { label: 'javascript', tags: ['javascript'] },
      ]);

      await seedV2();

      const user = await con.getRepository(User).findOneByOrFail({ id: '1' });
      expect(user.flags?.tagChipFeedsSeedStrategy).toEqual(
        TagChipSeedStrategy.V2,
      );
    });
  });
});
