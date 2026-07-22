import type { DataSource } from 'typeorm';
import { In } from 'typeorm';
import { User } from '../entity/user/User';
import { Keyword } from '../entity/Keyword';
import { ContentPreferenceKeyword } from '../entity/contentPreference/ContentPreferenceKeyword';
import { ContentPreferenceStatus } from '../entity/contentPreference/types';
import { feedClient } from '../integrations/feed/generators';
import { queryReadReplica } from './queryReadReplica';
import { updateFlagsStatement } from './utils';
import { ONE_DAY_IN_SECONDS } from './constants';
import { logger } from '../logger';

export type FeedTagsListItem = {
  value: string;
  label: string;
};

export type FeedTagsList = {
  tags: FeedTagsListItem[];
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

const resolveLabels = async ({
  con,
  values,
}: {
  con: DataSource;
  values: string[];
}): Promise<FeedTagsListItem[]> => {
  if (!values.length) {
    return [];
  }
  const keywords = await queryReadReplica(con, ({ queryRunner }) =>
    queryRunner.manager.getRepository(Keyword).find({
      where: { value: In(values) },
      select: ['value', 'flags'],
    }),
  );
  const labelByValue = new Map(keywords.map((k) => [k.value, k.flags?.title]));
  return values.map((value) => ({
    value,
    label: labelByValue.get(value) || value,
  }));
};

const writeCache = async ({
  con,
  userId,
  tags,
}: {
  con: DataSource;
  userId: string;
  tags: FeedTagsListItem[];
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

  let values: string[] = [];
  try {
    values = dedupeKeepOrder(await feedClient.getUserTags(userId, limit)).slice(
      0,
      limit,
    );
  } catch (err) {
    logger.error({ err, userId }, 'feedClient.getUserTags failed');
  }

  if (!values.length) {
    const followed = await queryReadReplica(con, ({ queryRunner }) =>
      queryRunner.manager.getRepository(ContentPreferenceKeyword).find({
        select: ['keywordId'],
        where: {
          userId,
          feedId: userId,
          status: ContentPreferenceStatus.Follow,
        },
        take: limit,
      }),
    );
    values = dedupeKeepOrder(followed.map((pref) => pref.keywordId)).slice(
      0,
      limit,
    );
  }

  const tags = await resolveLabels({ con, values });

  await writeCache({ con, userId, tags });

  return { tags };
};
