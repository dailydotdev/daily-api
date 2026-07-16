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
import { recswipeClient } from '../../src/integrations/recswipe/clients';
import { seedTagChipFeedsIfNeeded } from '../../src/common/seedTagChipFeeds';

jest.mock('../../src/integrations/feed/generators', () => ({
  ...jest.requireActual('../../src/integrations/feed/generators'),
  feedClient: {
    getUserTags: jest.fn(),
  },
}));

jest.mock('../../src/integrations/recswipe/clients', () => ({
  ...jest.requireActual('../../src/integrations/recswipe/clients'),
  recswipeClient: {
    recommendTags: jest.fn(),
  },
}));

const getUserTagsMock = feedClient.getUserTags as jest.MockedFunction<
  typeof feedClient.getUserTags
>;
const recommendTagsMock = recswipeClient.recommendTags as jest.MockedFunction<
  typeof recswipeClient.recommendTags
>;

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  getUserTagsMock.mockReset();
  recommendTagsMock.mockReset();
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
    expect(recommendTagsMock).not.toHaveBeenCalled();
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
    recommendTagsMock.mockResolvedValue({ recommended_tags: [] });

    await seedTagChipFeedsIfNeeded({ con, userId: '1', limit: 5 });
    expect(await getChipFeeds('1')).toHaveLength(0);

    // a second call must NOT call upstream again — flag is set
    getUserTagsMock.mockClear();
    recommendTagsMock.mockClear();
    getUserTagsMock.mockResolvedValue(['javascript']);
    recommendTagsMock.mockResolvedValue({
      recommended_tags: [{ tag: 'nodejs', score: 0.9 }],
    });

    await seedTagChipFeedsIfNeeded({ con, userId: '1', limit: 5 });
    expect(await getChipFeeds('1')).toHaveLength(0);
    expect(getUserTagsMock).not.toHaveBeenCalled();
    expect(recommendTagsMock).not.toHaveBeenCalled();
  });

  it('backfills with recswipe when feedClient returns fewer than limit', async () => {
    getUserTagsMock.mockResolvedValue(['javascript']);
    recommendTagsMock.mockResolvedValue({
      recommended_tags: [
        { tag: 'nodejs', score: 0.9 },
        { tag: 'webdev', score: 0.8 },
      ],
    });

    await seedTagChipFeedsIfNeeded({ con, userId: '1', limit: 3 });

    const feeds = await getChipFeeds('1');
    expect(feeds).toHaveLength(3);
    expect(recommendTagsMock).toHaveBeenCalledWith('1', {
      selectedTags: ['javascript'],
      n: 2,
    });
  });

  it('seeds nothing when feedClient, recswipe and onboarding follows are all empty', async () => {
    getUserTagsMock.mockResolvedValue([]);
    recommendTagsMock.mockResolvedValue({ recommended_tags: [] });

    await seedTagChipFeedsIfNeeded({ con, userId: '1', limit: 5 });

    expect(await getChipFeeds('1')).toHaveLength(0);
  });

  it('falls back to onboarding follows when feedClient and recswipe return nothing', async () => {
    getUserTagsMock.mockResolvedValue([]);
    recommendTagsMock.mockResolvedValue({ recommended_tags: [] });
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
    expect(recommendTagsMock).toHaveBeenCalled();
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
    expect(recommendTagsMock).not.toHaveBeenCalled();

    // flag is still set — bootstrap won't retry on next call.
    const user = await con.getRepository(User).findOneByOrFail({ id: '1' });
    expect(user.flags?.tagChipFeedsSeededAt).toEqual(expect.any(String));
  });

  it('falls back to recswipe only when feedClient fails', async () => {
    getUserTagsMock.mockRejectedValue(new Error('boom'));
    recommendTagsMock.mockResolvedValue({
      recommended_tags: [{ tag: 'nodejs', score: 0.9 }],
    });

    await seedTagChipFeedsIfNeeded({ con, userId: '1', limit: 2 });

    const feeds = await getChipFeeds('1');
    expect(feeds.map((f) => f.flags.name)).toEqual(['Node.js']);
    expect(recommendTagsMock).toHaveBeenCalledWith('1', {
      selectedTags: [],
      n: 2,
    });
  });
});
