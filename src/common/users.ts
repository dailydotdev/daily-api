import { getPostCommenterIds } from './post';
import { Post } from './../entity/Post';
import { IFlags } from 'flagsmith-nodejs';
import { isSameDay } from 'date-fns';
import fetch from 'node-fetch';
import { Connection, In, Not } from 'typeorm';
import { CommentMention, Comment, View } from '../entity';
import { getTimezonedStartOfISOWeek, getTimezonedEndOfISOWeek } from './utils';
import { User as DbUser } from './../entity/User';

interface UserInfo {
  name?: string;
  email?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  image: string;
  premium?: boolean;
  reputation: number;
  permalink: string;
  username?: string;
  timezone?: string;
}

export type CustomObject<T> = Record<string, T> | Record<number, T>;

const authorizedHeaders = (userId: string): { [key: string]: string } => ({
  authorization: `Service ${process.env.GATEWAY_SECRET}`,
  'user-id': userId,
  'logged-in': 'true',
});

export const fetchUser = async (userId: string): Promise<User | null> => {
  const res = await fetch(`${process.env.GATEWAY_URL}/v1/users/me`, {
    method: 'GET',
    headers: authorizedHeaders(userId),
  });
  if (res.status !== 200) {
    return null;
  }
  return res.json();
};

export const fetchUserById = async (userId: string): Promise<User> => {
  const res = await fetch(`${process.env.GATEWAY_URL}/v1/users/${userId}`, {
    method: 'GET',
    headers: authorizedHeaders(userId),
  });
  if (res.status !== 200) {
    return null;
  }
  return res.json();
};

export const fetchUserInfo = async (userId: string): Promise<UserInfo> => {
  const res = await fetch(`${process.env.GATEWAY_URL}/v1/users/me/info`, {
    method: 'GET',
    headers: authorizedHeaders(userId),
  });
  return res.json();
};

export const fetchUserRoles = async (userId: string): Promise<string[]> => {
  const res = await fetch(`${process.env.GATEWAY_URL}/v1/users/me/roles`, {
    method: 'GET',
    headers: authorizedHeaders(userId),
  });
  return res.json();
};

export const fetchUserFeatures = async (userId: string): Promise<IFlags> => {
  const res = await fetch(`${process.env.GATEWAY_URL}/boot/features`, {
    method: 'GET',
    headers: authorizedHeaders(userId),
  });
  const text = await res.text();

  if (!text) return {};

  return JSON.parse(text);
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
  excludeIds?: string[];
}

export const getRecentMentionsIds = async (
  con: Connection,
  userId: string,
  { limit = 5, query, excludeIds }: RecentMentionsProps,
): Promise<string[]> => {
  let queryBuilder = con
    .getRepository(CommentMention)
    .createQueryBuilder('cm')
    .select('DISTINCT cm."mentionedUserId"')
    .where({ commentByUserId: userId })
    .andWhere({ mentionedUserId: Not(userId) });

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
  con: Connection,
  { query, limit = 5, excludeIds }: RecentMentionsProps,
): Promise<string[]> => {
  let queryBuilder = con
    .getRepository(DbUser)
    .createQueryBuilder()
    .select('id')
    .where('(name ILIKE :name OR username ILIKE :name)', {
      name: `${query}%`,
    })
    .limit(limit);

  if (excludeIds?.length) {
    queryBuilder = queryBuilder.andWhere({
      id: Not(In(excludeIds)),
    });
  }

  const result = await queryBuilder.getRawMany<User>();

  return result.map((user) => user.id);
};

export const recommendUsersByQuery = async (
  con: Connection,
  userId: string,
  { query, limit }: RecentMentionsProps,
): Promise<string[]> => {
  const recentIds = await getRecentMentionsIds(con, userId, { query, limit });
  const missing = limit - recentIds.length;

  if (missing === 0) {
    return recentIds;
  }

  const userIds = await getUserIdsByNameOrUsername(con, {
    limit: missing,
    query,
    excludeIds: recentIds.concat(userId),
  });

  return recentIds.concat(userIds);
};

export const recommendUsersToMention = async (
  con: Connection,
  postId: string,
  userId: string,
  { limit }: RecentMentionsProps,
): Promise<string[]> => {
  const [post, commenterIds] = await Promise.all([
    con.getRepository(Post).findOne({ id: postId, authorId: Not(userId) }),
    getPostCommenterIds(con, postId, { limit, userId }),
  ]);

  if (post?.authorId) {
    if (commenterIds.length === 5) {
      commenterIds[4] = post.authorId;
    } else {
      commenterIds.unshift(post.authorId);
    }
  }

  const missing = limit - commenterIds.length;

  if (missing === 0) {
    return commenterIds;
  }

  const recent = await getRecentMentionsIds(con, userId, {
    limit: missing,
    excludeIds: commenterIds,
  });

  return commenterIds.concat(recent);
};

export const getUserReadingTags = (
  con: Connection,
  { userId, dateRange: { start, end }, limit = 8 }: ReadingDaysArgs,
): Promise<TagsReadingStatus[]> => {
  return con.query(
    `
    with filtered_view as (
      select  *, CAST(v."timestamp"::timestamptz at time zone COALESCE(u.timezone, 'utc') AS DATE) as day
      from    "view" v
      inner   join "user" u
      on      u."id" = v."userId"

      where   u."id" = $1
      and     "timestamp" >= $2
      and     "timestamp" < $3
    )
    select  *,
            (select count(DISTINCT day) from filtered_view) as total,
            tags."readingDays" * 1.0 / (select count(DISTINCT day) from filtered_view) as percentage
    from (
      select pk.keyword as tag, count(DISTINCT day) as "readingDays"
      from filtered_view v
      inner join post_keyword pk on v."postId" = pk."postId" and pk.status = 'allow'
      where pk.keyword != 'general-programming'
      group by pk.keyword
    ) as tags
    order by tags."readingDays" desc
    limit $4;
  `,
    [userId, start, end, limit],
  );
};

export const getUserReadingRank = async (
  con: Connection,
  userId: string,
  timezone = 'utc',
  version = 1,
  limit = 6,
): Promise<ReadingRank> => {
  if (!timezone || timezone === null) {
    timezone = 'utc';
  }
  const nowTimezone = `timezone('${timezone}', now())`;
  const atTimezone = `at time zone '${timezone}'`;
  const req = con
    .createQueryBuilder()
    .select(
      `count(distinct date_trunc('day', "timestamp"::timestamptz ${atTimezone}) ${atTimezone}) filter(where "timestamp" >= date_trunc('week', ${nowTimezone}) ${atTimezone})`,
      'thisWeek',
    )
    .addSelect(
      `count(distinct date_trunc('day', "timestamp"::timestamptz ${atTimezone}) ${atTimezone}) filter(where "timestamp" BETWEEN (date_trunc('week', ${nowTimezone} - interval '7 days') ${atTimezone}) AND (date_trunc('week', ${nowTimezone}) ${atTimezone}))`,
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
