import { Connection } from 'typeorm';
import { feedToFilters } from './common';
import fetch from 'node-fetch';
import { redisClient } from './redis';

interface TinybirdResponse<T> {
  data: T[];
}

async function fetchTinybirdFeed(
  con: Connection,
  pageSize: number,
  userId?: string,
  feedId?: string,
): Promise<{ post_id: string }[]> {
  const freshPageSize = Math.ceil(pageSize / 3).toFixed(0);
  let url = `${process.env.TINYBIRD_FEED}&page_size=${pageSize}&fresh_page_size=${freshPageSize}`;
  if (userId) {
    url += `&user_id=${userId}`;
  }
  if (feedId) {
    const filters = await feedToFilters(con, feedId);
    if (filters.includeTags?.length) {
      url += `&allowed_tags=${filters.includeTags.join(',')}`;
    }
    if (filters.blockedTags?.length) {
      url += `&blocked_tags=${filters.blockedTags.join(',')}`;
    }
    if (filters.excludeSources?.length) {
      url += `&blocked_sources=${filters.excludeSources.join(',')}`;
    }
  }
  const res = await fetch(url);
  const body: TinybirdResponse<{ post_id: string }> = await res.json();
  return body.data;
}

export const getPersonalizedFeedKey = (
  userId?: string,
  feedId?: string,
): string => `feeds:${feedId || 'global'}:${userId || 'anonymous'}`;

const ONE_DAY_SECONDS = 24 * 60 * 60;

async function cacheFeed(
  con: Connection,
  pageSize: number,
  userId?: string,
  feedId?: string,
): Promise<{ post_id: string }[]> {
  const key = getPersonalizedFeedKey(userId, feedId);
  const postIds = await fetchTinybirdFeed(con, pageSize, userId, feedId);
  const pipeline = redisClient.pipeline();
  pipeline.del(key);
  pipeline.expire(key, ONE_DAY_SECONDS);
  postIds.forEach(({ post_id }, i) => pipeline.zadd(key, i, post_id));
  // Don't wait for the promise to serve quickly the response
  pipeline.exec();
  return postIds;
}

export async function generatePersonalizedFeed(
  con: Connection,
  pageSize: number,
  offset: number,
  userId?: string,
  feedId?: string,
): Promise<string[]> {
  const key = getPersonalizedFeedKey(userId, feedId);
  if (offset) {
    const postIds = await redisClient.zrange(
      key,
      offset,
      pageSize + offset - 1,
    );
    if (postIds.length) {
      return postIds;
    }
  }
  const postIds = await cacheFeed(con, pageSize, userId, feedId);
  return postIds.slice(offset, pageSize + offset).map(({ post_id }) => post_id);
}
