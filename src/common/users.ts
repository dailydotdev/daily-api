import { getPostCommenterIds } from './post';
import { Post, User as DbUser, UserStreak } from './../entity';
import { differenceInDays, isSameDay } from 'date-fns';
import { DataSource, EntityManager, In, Not } from 'typeorm';
import { CommentMention, Comment, View, Source, SourceMember } from '../entity';
import { getTimezonedStartOfISOWeek, getTimezonedEndOfISOWeek } from './utils';
import { Context } from '../Context';
import { GraphQLResolveInfo } from 'graphql';
import { getTodayTz } from './date';

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

export interface GQLUserStreak {
  max?: number;
  total?: number;
  current?: number;
  lastViewAt?: Date;
  userId: string;
}

export interface GQLUserStreakTz extends GQLUserStreak {
  timezone: string;
  lastViewAtTz: Date;
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
      WITH filtered_view AS (
        SELECT
          v.*,
          CAST(v.timestamp AT TIME ZONE COALESCE(u.timezone,
              'UTC') AS DATE) AS day
        FROM
          "view" v
          JOIN "user" u ON u.id = v."userId"
        WHERE
          u.id = $1
          AND v.timestamp >= $2
          AND v.timestamp < $3
      ),
      distinct_days AS (
        SELECT
          COUNT(DISTINCT day) AS total_days
        FROM
          filtered_view
      ),
      tag_readings AS (
        SELECT
          pk.keyword AS tag,
          COUNT(DISTINCT f.day) AS "readingDays"
        FROM
          filtered_view f
          JOIN post_keyword pk ON f."postId" = pk."postId"
        WHERE
          pk.status = 'allow'
          AND pk.keyword != 'general-programming'
        GROUP BY
          pk.keyword
      )
      SELECT
        tr.tag,
        tr."readingDays",
        tr."readingDays" * 1.0 / dd.total_days AS percentage,
        dd.total_days AS total
      FROM
        tag_readings tr
        CROSS JOIN distinct_days dd
      ORDER BY
        tr."readingDays" DESC
      LIMIT $4;
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

export enum Day {
  Sunday,
  Monday,
  Tuesday,
  Wednesday,
  Thursday,
  Friday,
  Saturday,
}

export const Weekends = [Day.Sunday, Day.Saturday];
export const FREEZE_DAYS_IN_A_WEEK = Weekends.length;
export const MISSED_LIMIT = 1;

export const clearUserStreak = async (
  con: DataSource | EntityManager,
  userId,
): Promise<boolean> => {
  const result = await con
    .getRepository(UserStreak)
    .update({ userId }, { currentStreak: 0, updatedAt: new Date() });

  return result.affected > 0;
};

export const checkAndClearUserStreak = async (
  ctx: Context,
  info: GraphQLResolveInfo,
  streak: GQLUserStreakTz,
): Promise<boolean> => {
  const { lastViewAtTz: lastViewAt, timezone } = streak;

  if (!lastViewAt) {
    return false;
  }

  const today = getTodayTz(timezone);
  const day = today.getDay();
  const difference = differenceInDays(today, lastViewAt);

  // Even though it is the weekend, we should still clear the streak for when the user's last read was Thursday
  // Due to the fact that when Monday comes, we will clear it anyway when we notice the gap in Friday
  if (
    (day === Day.Sunday && difference > FREEZE_DAYS_IN_A_WEEK) ||
    (day === Day.Monday && difference > FREEZE_DAYS_IN_A_WEEK + MISSED_LIMIT) ||
    (day > Day.Monday && difference > MISSED_LIMIT)
  ) {
    return clearUserStreak(ctx.con, ctx.userId);
  }

  return false;
};
