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

export interface ReadingRank {
  rankThisWeek: number;
  rankLastWeek: number;
  currentRank: number;
  progressThisWeek: number;
  readToday: boolean;
}

interface ReadingRankQueryResult {
  thisWeek: number;
  lastWeek: number;
  today: number;
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

export const getUserReadingRank = async (
  con: Connection,
  userId: string,
  timezone = 'utc',
): Promise<ReadingRank> => {
  if (!timezone || timezone === null) {
    timezone = 'utc';
  }
  const now = `timezone('${timezone}', now())`;
  const res = await con
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
      `count(*) filter(where "timestamp" at time zone '${timezone}' >= date_trunc('day', ${now}))`,
      'today',
    )
    .from(View, 'view')
    .where('"userId" = :id', { id: userId })
    .getRawOne<ReadingRankQueryResult>();
  const rankThisWeek = rankFromProgress(res.thisWeek);
  const rankLastWeek = rankFromProgress(res.lastWeek);
  return {
    currentRank: rankThisWeek > rankLastWeek ? rankThisWeek : rankLastWeek,
    progressThisWeek: res.thisWeek,
    rankLastWeek,
    rankThisWeek,
    readToday: res.today > 0,
  };
};
