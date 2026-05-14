import type { DataSource } from 'typeorm';
import { User } from '../entity/user/User';
import { feedClient } from '../integrations/feed/generators';
import { recswipeClient } from '../integrations/recswipe/clients';
import { queryReadReplica } from './queryReadReplica';
import { updateFlagsStatement } from './utils';
import { ONE_DAY_IN_SECONDS } from './constants';
import { logger } from '../logger';

export type FeedTagsList = {
  tags: string[];
};

const CACHE_TTL_MS = ONE_DAY_IN_SECONDS * 1000;

const isFresh = (updatedAt: string): boolean => {
  const ts = Date.parse(updatedAt);
  if (Number.isNaN(ts)) {
    return false;
  }
  return Math.abs(Date.now() - ts) < CACHE_TTL_MS;
};

const dedupeKeepOrder = (tags: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    if (!seen.has(tag)) {
      seen.add(tag);
      result.push(tag);
    }
  }
  return result;
};

const writeCache = async ({
  con,
  userId,
  tags,
}: {
  con: DataSource;
  userId: string;
  tags: string[];
}): Promise<void> => {
  await con.getRepository(User).update(
    { id: userId },
    {
      flags: updateFlagsStatement<User>({
        feedTagsList: {
          tags,
          updatedAt: new Date().toISOString(),
        },
      }),
    },
  );
};

export const getFeedTagsList = async ({
  con,
  userId,
  limit,
}: {
  con: DataSource;
  userId: string;
  limit: number;
}): Promise<FeedTagsList> => {
  const user = await queryReadReplica(con, ({ queryRunner }) =>
    queryRunner.manager
      .getRepository(User)
      .findOne({ where: { id: userId }, select: ['id', 'flags'] }),
  );

  const cached = user?.flags?.feedTagsList;
  if (cached && isFresh(cached.updatedAt)) {
    return { tags: cached.tags.slice(0, limit) };
  }

  let tags: string[];
  try {
    tags = await feedClient.getUserTags(userId, limit);
  } catch (err) {
    logger.error(
      { err, userId },
      'feedClient.getUserTags failed; caching empty feedTagsList',
    );
    await writeCache({ con, userId, tags: [] });
    return { tags: [] };
  }

  tags = dedupeKeepOrder(tags);

  if (tags.length < limit) {
    try {
      const supplement = await recswipeClient.recommendTags(userId, {
        selectedTags: tags,
        n: limit - tags.length,
      });
      const supplementTags = (supplement.recommended_tags ?? []).map(
        (t) => t.tag,
      );
      tags = dedupeKeepOrder([...tags, ...supplementTags]).slice(0, limit);
    } catch (err) {
      logger.error(
        { err, userId },
        'recswipeClient.recommendTags failed; using feedClient tags only',
      );
    }
  }

  await writeCache({ con, userId, tags });

  return { tags };
};
