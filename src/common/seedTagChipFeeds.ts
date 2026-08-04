import type { DataSource } from 'typeorm';
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

const getSeedTagValues = async ({
  con,
  userId,
  limit,
}: {
  con: DataSource;
  userId: string;
  limit: number;
}): Promise<string[]> => {
  let values: string[] = [];
  try {
    values = dedupeKeepOrder(await feedClient.getUserTags(userId, limit)).slice(
      0,
      limit,
    );
  } catch (err) {
    logger.error(
      { err, userId },
      'feedClient.getUserTags failed; tag-chip seeding will fall back to onboarding follows',
    );
  }

  if (!values.length) {
    values = dedupeKeepOrder(
      await getUserOnboardingTags({ con, userId, limit }),
    ).slice(0, limit);
  }

  return values;
};

const getSeedTopics = async ({
  con,
  userId,
  limit,
}: {
  con: DataSource;
  userId: string;
  limit: number;
}): Promise<FeedTopic[]> => {
  const tags = dedupeKeepOrder(await getUserOnboardingTags({ con, userId }));

  if (!tags.length) {
    return [];
  }

  const topics = await feedClient.getTopics(
    tags,
    remoteConfig.vars.tagChipTopicsClusterThreshold,
  );
  const seenLabels = new Set<string>();

  return topics
    .map(({ label, tags: topicTags }) => ({
      label,
      tags: dedupeKeepOrder(topicTags ?? []),
    }))
    .filter(({ label, tags: topicTags }) => {
      if (!label || !topicTags.length || seenLabels.has(label)) {
        return false;
      }

      seenLabels.add(label);

      return true;
    })
    .slice(0, limit);
};

/**
 * Lazily seeds the caller's tag-chip feeds the first time they opt in via
 * `includeTagChipFeeds`. Gated by `User.flags.tagChipFeedsSeededAt`: set
 * atomically before any seed work happens, so a second call is a guaranteed
 * no-op even if the first failed mid-flight. Skipped if the user is at the
 * `maxFeedsPerUser` cap (no chip feeds get written; flag still marked so we
 * don't retry on every read).
 *
 * Strategy `V1` (default) seeds one single-tag feed per tag from
 * `feedClient.getUserTags`, falling back to the user's onboarding tags.
 * Strategy `V2` clusters those onboarding tags into topics via
 * `feedClient.getTopics` and seeds one multi-tag feed per topic, falling back to
 * `V1` when clustering is unavailable or yields nothing.
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

  let topics: FeedTopic[] = [];

  if (strategy === TagChipSeedStrategy.V2) {
    try {
      topics = await getSeedTopics({ con, userId, limit: effectiveLimit });
    } catch (err) {
      logger.error(
        { err, userId },
        'feedClient.getTopics failed; tag-chip seeding will fall back to single-tag feeds',
      );
    }
  }

  if (!topics.length) {
    const values = await getSeedTagValues({
      con,
      userId,
      limit: effectiveLimit,
    });

    topics = values.map((value) => ({ label: value, tags: [value] }));
  }

  if (!topics.length) {
    return false;
  }

  const labelByValue = await resolveLabel({
    con,
    values: topics.map(({ label }) => label),
  });

  await con.transaction(async (manager) => {
    for (const topic of topics) {
      const feedId = await generateShortId();
      await manager.getRepository(Feed).save({
        id: feedId,
        userId,
        flags: {
          name: labelByValue.get(topic.label) || topic.label,
          origin: FeedOrigin.TagChip,
        },
      });
      for (const tag of topic.tags) {
        await manager.getRepository(ContentPreferenceKeyword).save({
          userId,
          feedId,
          referenceId: tag,
          keywordId: tag,
          status: ContentPreferenceStatus.Follow,
          type: ContentPreferenceType.Keyword,
        });
        await manager.getRepository(FeedTag).save({ feedId, tag });
      }
    }
  });

  return true;
};
