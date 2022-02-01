import { IFlags } from 'flagsmith-nodejs';
import { isSameDay } from 'date-fns';
import fetch from 'node-fetch';
import { Connection } from 'typeorm';
import { View } from '../entity';

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

export interface TagsReadingStatus {
  tag: string;
  readingDays: number;
  percentage: number;
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

const STEPS_PER_RANK = [3, 4, 5, 6, 7];
const STEPS_PER_RANK_REVERSE = STEPS_PER_RANK.reverse();

const rankFromProgress = (progress: number) => {
  const reverseRank = STEPS_PER_RANK_REVERSE.findIndex(
    (threshold) => progress >= threshold,
  );
  if (reverseRank > -1) {
    return STEPS_PER_RANK.length - reverseRank;
  }
  return 0;
};

interface ReadingDaysArgs {
  userId: string;
  timezone?: string;
  limit?: number;
}

const getUserReadingDays = (
  con: Connection,
  { userId, timezone = 'utc', limit = 8 }: ReadingDaysArgs,
) => {
  const now = `timezone('${timezone}', now())`;
  return con.query(
    `
    with filtered_view as (
      select *, CAST(v."timestamp" at time zone '${timezone}' AS DATE) as day
      from "view" v
      where "userId" = $1 and v."timestamp" at time zone '${timezone}' >= date_trunc('week', ${now})
    )
    select *, tags."readingDays" * 1.0 / (select count(DISTINCT day) from filtered_view) as relative
    from (
      select pk.keyword as tag, count(DISTINCT day) as "readingDays"
      from filtered_view v
      inner join post_keyword pk on v."postId" = pk."postId" and pk.status = 'allow'
      where pk.keyword != 'general-programming'
      group by pk.keyword
    ) as tags
    order by tags."readingDays" desc
    limit $2;
  `,
    [userId, limit],
  );
};

export const getUserReadingRank = async (
  con: Connection,
  userId: string,
  timezone = 'utc',
): Promise<ReadingRank> => {
  if (!timezone || timezone === null) {
    timezone = 'utc';
  }
  const now = `timezone('${timezone}', now())`;
  const req = con
    .createQueryBuilder()
    .select(
      `count(distinct date_trunc('day', "timestamp" at time zone '${timezone}')) filter(where "timestamp" at time zone '${timezone}' >= date_trunc('week', ${now}))`,
      'thisWeek',
    )
    .addSelect(
      `count(distinct date_trunc('day', "timestamp" at time zone '${timezone}')) filter(where "timestamp" at time zone '${timezone}' < date_trunc('week', ${now}) and "timestamp" at time zone '${timezone}' >= date_trunc('week', ${now} - interval '7 days'))`,
      'lastWeek',
    )
    .addSelect(
      `MAX("timestamp"::timestamp at time zone '${timezone}')`,
      'lastReadTime',
    )
    .from(View, 'view')
    .where('"userId" = :id', { id: userId });

  const [{ thisWeek, lastWeek, lastReadTime }, tags] = await Promise.all([
    req.getRawOne<ReadingRankQueryResult>(),
    getUserReadingDays(con, { userId, timezone }),
  ]);
  const rankThisWeek = rankFromProgress(thisWeek);
  const rankLastWeek = rankFromProgress(lastWeek);
  return {
    lastReadTime: lastReadTime,
    currentRank: rankThisWeek > rankLastWeek ? rankThisWeek : rankLastWeek,
    progressThisWeek: thisWeek,
    rankLastWeek,
    rankThisWeek,
    readToday: isSameDay(lastReadTime, new Date()),
    tags,
  };
};
