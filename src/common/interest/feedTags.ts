import type { DataSource } from 'typeorm';
import { FeedTag } from '../../entity/FeedTag';

export const DEFAULT_INTEREST_MAX_TAGS = 15;

export const addFeedTagsWithinCap = async ({
  con,
  feedId,
  tags,
  maxTags,
}: {
  con: DataSource;
  feedId: string;
  tags: string[];
  maxTags: number;
}): Promise<void> => {
  const unique = [...new Set(tags)];
  if (!unique.length) {
    return;
  }
  const existing = await con.getRepository(FeedTag).countBy({ feedId });
  const remaining = maxTags - existing;
  if (remaining <= 0) {
    return;
  }
  await con
    .getRepository(FeedTag)
    .createQueryBuilder()
    .insert()
    .values(unique.slice(0, remaining).map((tag) => ({ feedId, tag })))
    .orIgnore()
    .execute();
};

export const replaceFeedTags = async ({
  con,
  feedId,
  tags,
  maxTags,
}: {
  con: DataSource;
  feedId: string;
  tags: string[];
  maxTags: number;
}): Promise<void> => {
  const capped = [...new Set(tags)].slice(0, maxTags);
  await con.transaction(async (manager) => {
    await manager.getRepository(FeedTag).delete({ feedId });
    if (capped.length) {
      await manager
        .getRepository(FeedTag)
        .createQueryBuilder()
        .insert()
        .values(capped.map((tag) => ({ feedId, tag })))
        .orIgnore()
        .execute();
    }
  });
};
