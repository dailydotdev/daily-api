import { getPostCommenterIds } from './post';
import { Post } from './../entity/posts';
import { isSameDay } from 'date-fns';
import { DataSource, In, Not } from 'typeorm';
import {
  CommentMention,
  Comment,
  View,
  Source,
  SourceMember,
  AddUserData,
} from '../entity';
import { getTimezonedStartOfISOWeek, getTimezonedEndOfISOWeek } from './utils';
import { User as DbUser } from './../entity/User';
import { FastifyBaseLogger } from 'fastify';
import { UserPersonalizedDigest } from '../entity/UserPersonalizedDigest';
import { DayOfWeek } from '../types';

export interface User {
  id: string;
  email: string;
  name: string;
  image: string;
  infoConfirmed: boolean;
  premium?: boolean;
  reputation: number;
  permalink: string;
  username?: string;
  timezone?: string;
  acceptedMarketing?: boolean;
}

export const fetchUser = async (
  userId: string,
  con: DataSource,
): Promise<User | null> => {
  const user = await con.getRepository(DbUser).findOneBy({ id: userId });
  if (!user) {
    return null;
  }
  return user;
};

export const getUserProfileUrl = (username: string): string =>
  `${process.env.COMMENTS_PREFIX}/${username}`;

export interface TagsReadingStatus {
  tag: string;
  readingDays: number;
  percentage: number;
  total: number;
}

export interface ReadingRank {
  rankThisWeek: number;
  rankLastWeek: number;
  currentRank: number;
  progressThisWeek: number;
  readToday: boolean;
  lastReadTime: Date;
  tags: TagsReadingStatus[];
}

interface ReadingRankQueryResult {
  thisWeek: number;
  lastWeek: number;
  today: number;
  lastReadTime: Date;
}

const V1_STEPS_PER_RANK = [3, 4, 5, 6, 7];
const STEPS_PER_RANK_REVERSE = V1_STEPS_PER_RANK.reverse();

const rankFromProgress = (progress: number) => {
  const reverseRank = STEPS_PER_RANK_REVERSE.findIndex(
    (threshold) => progress >= threshold,
  );
  if (reverseRank > -1) {
    return V1_STEPS_PER_RANK.length - reverseRank;
  }
  return 0;
};

type DateRange = { start: string; end: string };

export interface ReadingDaysArgs {
  userId: string;
  limit?: number;
  dateRange: DateRange;
}

interface RecentMentionsProps {
  query?: string;
  limit?: number;
  postId?: string;
  sourceId?: string;
  excludeIds?: string[];
}

export const getRecentMentionsIds = async (
  con: DataSource,
  userId: string,
  { limit = 5, query, excludeIds, sourceId }: RecentMentionsProps,
): Promise<string[]> => {
  let queryBuilder = con
    .getRepository(CommentMention)
    .createQueryBuilder('cm')
    .select('DISTINCT cm."mentionedUserId"')
    .where({ commentByUserId: userId })
    .andWhere({ mentionedUserId: Not(userId) });

  if (sourceId) {
    queryBuilder = queryBuilder
      .innerJoin(SourceMember, 'sm', 'sm."userId" = cm."mentionedUserId"')
      .andWhere('sm."sourceId" = :sourceId', { sourceId });
  }

  if (query) {
    queryBuilder = queryBuilder
      .select('DISTINCT cm."mentionedUserId", u.name')
      .innerJoin(Comment, 'c', 'cm."commentId" = c.id')
      .innerJoin(DbUser, 'u', 'u.id = cm."mentionedUserId"')
      .andWhere('(u.name ILIKE :name OR u.username ILIKE :name)', {
        name: `${query}%`,
      })
      .orderBy('u.name');
  }

  if (excludeIds?.length) {
    queryBuilder = queryBuilder.andWhere({
      mentionedUserId: Not(In(excludeIds)),
    });
  }

  const result = await queryBuilder.limit(limit).getRawMany<CommentMention>();

  return result.map((user) => user.mentionedUserId);
};

export const getUserIdsByNameOrUsername = async (
  con: DataSource,
  { query, limit = 5, excludeIds, sourceId }: RecentMentionsProps,
): Promise<string[]> => {
  let queryBuilder = con
    .getRepository(DbUser)
    .createQueryBuilder()
    .select('id')
    .where(`(replace(name, ' ', '') ILIKE :name OR username ILIKE :name)`, {
      name: `${query}%`,
    })
    .andWhere('username IS NOT NULL')
    .limit(limit);

  if (sourceId) {
    queryBuilder = queryBuilder
      .innerJoin(SourceMember, 'sm', 'id = sm."userId"')
      .andWhere('sm."sourceId" = :sourceId', { sourceId });
  }

  if (excludeIds?.length) {
    queryBuilder = queryBuilder.andWhere({
      id: Not(In(excludeIds)),
    });
  }

  const result = await queryBuilder.getRawMany<User>();

  return result.map((user) => user.id);
};

export const recommendUsersByQuery = async (
  con: DataSource,
  userId: string,
  { query, limit, sourceId }: RecentMentionsProps,
): Promise<string[]> => {
  const privateSource = await (sourceId &&
    con.getRepository(Source).findOneBy({ id: sourceId, private: true }));
  const recentIds = await getRecentMentionsIds(con, userId, {
    query,
    limit,
    sourceId: privateSource?.id,
  });
  const missing = limit - recentIds.length;

  if (missing === 0) {
    return recentIds;
  }

  const userIds = await getUserIdsByNameOrUsername(con, {
    limit: missing,
    query,
    sourceId: privateSource?.id,
    excludeIds: recentIds.concat(userId),
  });

  return recentIds.concat(userIds);
};

export const recommendUsersToMention = async (
  con: DataSource,
  userId: string,
  { limit, postId, sourceId }: RecentMentionsProps,
): Promise<string[]> => {
  const ids: string[] = [];

  if (postId) {
    const [post, commenterIds] = await Promise.all([
      con.getRepository(Post).findOneBy({ id: postId, authorId: Not(userId) }),
      getPostCommenterIds(con, postId, { limit, userId }),
    ]);

    if (post?.authorId) {
      commenterIds.unshift(post.authorId);
      if (commenterIds.length > 5) {
        commenterIds.pop();
      }
    }

    ids.push(...commenterIds);
  }

  const missing = limit - ids.length;

  if (missing === 0) {
    return ids;
  }

  const privateSource = await (sourceId &&
    con.getRepository(Source).findOneBy({ id: sourceId, private: true }));
  const recent = await getRecentMentionsIds(con, userId, {
    limit: missing,
    excludeIds: ids,
    sourceId: privateSource?.id,
  });

  return ids.concat(recent);
};

export const getUserReadingTags = (
  con: DataSource,
  { userId, dateRange: { start, end }, limit = 8 }: ReadingDaysArgs,
): Promise<TagsReadingStatus[]> => {
  return con.query(
    `
      with filtered_view as (select *,
                                    CAST(v."timestamp"::timestamptz at time zone
                                         COALESCE(u.timezone, 'utc') AS
                                         DATE) as day
      from "view" v
        inner join "user" u
      on u."id" = v."userId"

      where u."id" = $1
        and "timestamp" >= $2
        and "timestamp"
          < $3
        )
      select *,
             (select count(DISTINCT day) from filtered_view) as total,
             tags."readingDays" * 1.0 /
             (select count(DISTINCT day) from filtered_view) as percentage
      from (select pk.keyword as tag, count(DISTINCT day) as "readingDays"
            from filtered_view v
                   inner join post_keyword pk
                              on v."postId" = pk."postId" and pk.status = 'allow'
            where pk.keyword != 'general-programming'
            group by pk.keyword) as tags
      order by tags."readingDays" desc
        limit $4;
    `,
    [userId, start, end, limit],
  );
};

export const getUserReadingRank = async (
  con: DataSource,
  userId: string,
  timezone = 'utc',
  version = 1,
  limit = 6,
): Promise<ReadingRank> => {
  if (!timezone) {
    timezone = 'utc';
  }
  const atTimezone = `at time zone '${timezone}'`;
  const req = con
    .createQueryBuilder()
    .select(
      `count(distinct extract(dow from "timestamp"::timestamptz ${atTimezone})) filter(where "timestamp"::timestamptz ${atTimezone} >= date_trunc('week', now())::timestamptz ${atTimezone})`,
      'thisWeek',
    )
    .addSelect(
      `count(distinct extract(dow from "timestamp"::timestamptz ${atTimezone})) filter(where "timestamp"::timestamptz ${atTimezone} BETWEEN (date_trunc('week', now() - interval '7 days')::timestamptz ${atTimezone}) AND (date_trunc('week', now())::timestamptz ${atTimezone}))`,
      'lastWeek',
    )
    .addSelect(`MAX("timestamp"::timestamptz ${atTimezone})`, 'lastReadTime')
    .from(View, 'view')
    .where('"userId" = :id', { id: userId });

  const now = new Date();
  const getReadingTags = () => {
    if (version === 1) {
      return Promise.resolve(null);
    }

    const start = getTimezonedStartOfISOWeek({
      date: now,
      timezone,
    }).toISOString();
    const end = getTimezonedEndOfISOWeek({ date: now, timezone }).toISOString();

    return getUserReadingTags(con, {
      limit,
      userId,
      dateRange: { start, end },
    });
  };

  const [{ thisWeek, lastWeek, lastReadTime }, tags] = await Promise.all([
    req.getRawOne<ReadingRankQueryResult>(),
    getReadingTags(),
  ]);
  const rankThisWeek = version === 1 ? rankFromProgress(thisWeek) : thisWeek;
  const rankLastWeek = version === 1 ? rankFromProgress(lastWeek) : lastWeek;
  return {
    lastReadTime,
    currentRank: rankThisWeek > rankLastWeek ? rankThisWeek : rankLastWeek,
    progressThisWeek: thisWeek,
    rankLastWeek,
    rankThisWeek,
    readToday: isSameDay(lastReadTime, now),
    tags,
  };
};

export const subscribeNewUserToPersonalizedDigest = async ({
  con,
  userData,
  logger,
}: {
  con: DataSource;
  userData: AddUserData;
  logger: FastifyBaseLogger;
}): Promise<void> => {
  try {
    await con.getRepository(UserPersonalizedDigest).save({
      userId: userData.id,
      preferredDay: DayOfWeek.Wednesday,
      preferredHour: 8,
      preferredTimezone: userData.timezone || undefined,
    });
  } catch (error) {
    logger.error(
      {
        data: userData,
        userId: userData.id,
        error,
      },
      'failed to subscribe new user to personalized digest',
    );
  }
};
