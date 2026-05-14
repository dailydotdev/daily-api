import type { DataSource } from 'typeorm';
import { User } from '../entity/user/User';
import { feedClient } from '../integrations/feed/generators';
import { recswipeClient } from '../integrations/recswipe/clients';
import { queryReadReplica } from './queryReadReplica';
import { updateFlagsStatement } from './utils';
import { ONE_DAY_IN_SECONDS } from './constants';

export type FeedTagsList = {
  tags: string[];
};

const CACHE_TTL_MS = ONE_DAY_IN_SECONDS * 1000;

const isFresh = (updatedAt: string): boolean => {
  const ts = Date.parse(updatedAt);
  if (Number.isNaN(ts)) {
    return false;
  }
  return Date.now() - ts < CACHE_TTL_MS;
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

  let tags = await feedClient.getUserTags(userId, limit);

  if (tags.length < limit) {
    const supplement = await recswipeClient.recommendTags(userId, {
      selectedTags: tags,
      n: limit - tags.length,
    });
    const supplementTags = (supplement.recommended_tags ?? []).map(
      (t) => t.tag,
    );
    tags = [...tags, ...supplementTags].slice(0, limit);
  }

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

  return { tags };
};
