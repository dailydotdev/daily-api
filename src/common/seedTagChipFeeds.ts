import type { DataSource, DeepPartial } from 'typeorm';
import { In } from 'typeorm';
import { Feed, FeedOrigin } from '../entity/Feed';
import { FeedTag } from '../entity/FeedTag';
import { Keyword } from '../entity/Keyword';
import { User } from '../entity/user/User';
import { ContentPreferenceKeyword } from '../entity/contentPreference/ContentPreferenceKeyword';
import {
  ContentPreferenceStatus,
  ContentPreferenceType,
} from '../entity/contentPreference/types';
import { feedClient } from '../integrations/feed/generators';
import type { FeedTopic } from '../integrations/feed/types';
import { queryReadReplica } from './queryReadReplica';
import { generateShortId } from '../ids';
import { logger } from '../logger';
import { maxFeedsPerUser, TagChipSeedStrategy } from '../types';
import { countUserOwnedFeeds, getUserOnboardingTags } from './feed';
import { remoteConfig } from '../remoteConfig';

export const TAG_CHIP_FEED_LIMIT = 5;

const dedupeKeepOrder = (values: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
};

const resolveLabel = async ({
  con,
  values,
}: {
  con: DataSource;
  values: string[];
}): Promise<Map<string, string>> => {
  if (!values.length) {
    return new Map();
  }
  const keywords = await queryReadReplica(con, ({ queryRunner }) =>
    queryRunner.manager.getRepository(Keyword).find({
      where: { value: In(values) },
      select: ['value', 'flags'],
    }),
  );
  const keywordByValue = new Map(keywords.map((k) => [k.value, k]));
  return new Map(
    values.map((value) => [
      value,
      keywordByValue.get(value)?.flags?.title || value,
    ]),
  );
};

/**
 * Atomically marks the user as seeded — sets `flags.tagChipFeedsSeededAt`
 * iff it's currently unset. Returns `true` if this call won the race and
 * should proceed with seeding, `false` if seeding already started elsewhere
 * (concurrent call, or previous seed already ran).
 */
const reserveSeedSlot = async ({
  con,
  userId,
  strategy,
}: {
  con: DataSource;
  userId: string;
  strategy: TagChipSeedStrategy;
}): Promise<boolean> => {
  const result = await con
    .createQueryBuilder()
    .update(User)
    .set({ flags: () => `flags || :seededJson::jsonb` })
    .where({ id: userId })
    .andWhere(`(flags->>'tagChipFeedsSeededAt') IS NULL`)
    .setParameter(
      'seededJson',
      JSON.stringify({
        tagChipFeedsSeededAt: new Date().toISOString(),
        tagChipFeedsSeedStrategy: strategy,
      }),
    )
    .execute();

  return (result.affected ?? 0) > 0;
};

const toSingleTagTopics = (values: string[]): FeedTopic[] =>
  dedupeKeepOrder(values).map((value) => ({ label: value, tags: [value] }));

const getClusteredTopics = async ({
  con,
  userId,
}: {
  con: DataSource;
  userId: string;
}): Promise<FeedTopic[]> => {
  const tags = dedupeKeepOrder(await getUserOnboardingTags({ con, userId }));

  return tags.length
    ? feedClient.getTopics(
        tags,
        remoteConfig.vars.tagChipTopicsClusterThreshold,
      )
    : [];
};

const getSeedTopics = async ({
  con,
  userId,
  limit,
  strategy,
}: {
  con: DataSource;
  userId: string;
  limit: number;
  strategy: TagChipSeedStrategy;
}): Promise<FeedTopic[]> => {
  let topics: FeedTopic[] = [];
  try {
    topics =
      strategy === TagChipSeedStrategy.V2
        ? await getClusteredTopics({ con, userId })
        : toSingleTagTopics(await feedClient.getUserTags(userId, limit));
  } catch (err) {
    logger.error(
      { err, userId, strategy },
      'tag-chip seed source failed; seeding will fall back to onboarding tags',
    );
  }

  if (!topics.length) {
    topics = toSingleTagTopics(
      await getUserOnboardingTags({ con, userId, limit }),
    );
  }

  return topics.slice(0, limit);
};

/**
 * Lazily seeds the caller's tag-chip feeds the first time they opt in via
 * `includeTagChipFeeds`. Gated by `User.flags.tagChipFeedsSeededAt`: set
 * atomically before any seed work happens, so a second call is a guaranteed
 * no-op even if the first failed mid-flight. Skipped if the user is at the
 * `maxFeedsPerUser` cap (no chip feeds get written; flag still marked so we
 * don't retry on every read).
 *
 * The strategy only picks the seed source: `V1` (default) takes single tags
 * from `feedClient.getUserTags`, `V2` clusters the user's onboarding tags into
 * multi-tag topics via `feedClient.getTopics`. Either way, an empty or failed
 * source falls back to the user's onboarding tags as single-tag topics.
 */
export const seedTagChipFeedsIfNeeded = async ({
  con,
  userId,
  limit = TAG_CHIP_FEED_LIMIT,
  strategy = TagChipSeedStrategy.V1,
}: {
  con: DataSource;
  userId: string;
  limit?: number;
  strategy?: TagChipSeedStrategy;
}): Promise<boolean> => {
  const reserved = await reserveSeedSlot({ con, userId, strategy });
  if (!reserved) {
    return false;
  }

  const existingFeedsCount = await queryReadReplica(con, ({ queryRunner }) =>
    countUserOwnedFeeds({ con: queryRunner.manager, userId }),
  );
  const effectiveLimit = Math.min(limit, maxFeedsPerUser - existingFeedsCount);

  if (effectiveLimit <= 0) {
    return false;
  }

  const topics = await getSeedTopics({
    con,
    userId,
    limit: effectiveLimit,
    strategy,
  });
  if (!topics.length) {
    return false;
  }

  const labelByValue = await resolveLabel({
    con,
    values: topics.map(({ label }) => label),
  });

  const feeds: DeepPartial<Feed>[] = [];
  const preferences: DeepPartial<ContentPreferenceKeyword>[] = [];
  const feedTags: DeepPartial<FeedTag>[] = [];

  for (const topic of topics) {
    const feedId = await generateShortId();
    feeds.push({
      id: feedId,
      userId,
      flags: {
        name: labelByValue.get(topic.label) || topic.label,
        origin: FeedOrigin.TagChip,
      },
    });

    for (const tag of topic.tags) {
      preferences.push({
        userId,
        feedId,
        referenceId: tag,
        keywordId: tag,
        status: ContentPreferenceStatus.Follow,
        type: ContentPreferenceType.Keyword,
      });
      feedTags.push({ feedId, tag });
    }
  }

  await con.transaction(async (manager) => {
    await manager.getRepository(Feed).save(feeds);
    await manager.getRepository(ContentPreferenceKeyword).save(preferences);
    await manager.getRepository(FeedTag).save(feedTags);
  });

  return true;
};
