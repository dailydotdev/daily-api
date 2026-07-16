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
import { recswipeClient } from '../integrations/recswipe/clients';
import { queryReadReplica } from './queryReadReplica';
import { generateShortId } from '../ids';
import { logger } from '../logger';
import { maxFeedsPerUser } from '../types';

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
}: {
  con: DataSource;
  userId: string;
}): Promise<boolean> => {
  const result = await con
    .createQueryBuilder()
    .update(User)
    .set({ flags: () => `flags || :seededJson::jsonb` })
    .where({ id: userId })
    .andWhere(`(flags->>'tagChipFeedsSeededAt') IS NULL`)
    .setParameter(
      'seededJson',
      JSON.stringify({ tagChipFeedsSeededAt: new Date().toISOString() }),
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
      'feedClient.getUserTags failed; tag-chip seeding will fall back to recswipe',
    );
  }

  if (values.length < limit) {
    try {
      const supplement = await recswipeClient.recommendTags(userId, {
        selectedTags: values,
        n: limit - values.length,
      });
      const recommended = (supplement.recommended_tags ?? []).map((t) => t.tag);
      values = dedupeKeepOrder([...values, ...recommended]).slice(0, limit);
    } catch (err) {
      logger.error(
        { err, userId },
        'recswipeClient.recommendTags failed; seeding tag-chip feeds with feedClient tags only',
      );
    }
  }

  if (!values.length) {
    const followed = await con.getRepository(ContentPreferenceKeyword).find({
      select: ['keywordId'],
      where: {
        userId,
        feedId: userId,
        status: ContentPreferenceStatus.Follow,
      },
      take: limit,
    });
    values = dedupeKeepOrder(followed.map((pref) => pref.keywordId)).slice(
      0,
      limit,
    );
  }

  return values;
};

/**
 * Lazily seeds one custom feed per tag (feedClient.getUserTags + recswipe backfill)
 * the first time the caller opts in via `includeTagChipFeeds`. Gated by
 * `User.flags.tagChipFeedsSeededAt`: set atomically before any seed work
 * happens, so a second call is a guaranteed no-op even if the first failed
 * mid-flight. Skipped if the user is at the `maxFeedsPerUser` cap (no chip
 * feeds get written; flag still marked so we don't retry on every read).
 */
export const seedTagChipFeedsIfNeeded = async ({
  con,
  userId,
  limit = TAG_CHIP_FEED_LIMIT,
}: {
  con: DataSource;
  userId: string;
  limit?: number;
}): Promise<boolean> => {
  const reserved = await reserveSeedSlot({ con, userId });
  if (!reserved) {
    return false;
  }

  const existingFeedsCount = await queryReadReplica(con, ({ queryRunner }) =>
    queryRunner.manager.getRepository(Feed).countBy({ userId }),
  );
  const effectiveLimit = Math.min(limit, maxFeedsPerUser - existingFeedsCount);

  if (effectiveLimit <= 0) {
    return false;
  }

  const values = await getSeedTagValues({
    con,
    userId,
    limit: effectiveLimit,
  });
  if (!values.length) {
    return false;
  }

  const labelByValue = await resolveLabel({ con, values });

  await con.transaction(async (manager) => {
    for (const value of values) {
      const feedId = await generateShortId();
      await manager.getRepository(Feed).save({
        id: feedId,
        userId,
        flags: {
          name: labelByValue.get(value) || value,
          origin: FeedOrigin.TagChip,
        },
      });
      await manager.getRepository(ContentPreferenceKeyword).save({
        userId,
        feedId,
        referenceId: value,
        keywordId: value,
        status: ContentPreferenceStatus.Follow,
        type: ContentPreferenceType.Keyword,
      });
      await manager.getRepository(FeedTag).save({ feedId, tag: value });
    }
  });

  return true;
};
