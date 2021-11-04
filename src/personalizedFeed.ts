import { Agent } from 'https';
import { Connection } from 'typeorm';
import { feedToFilters } from './common';
import fetch from 'node-fetch';
import { redisClient } from './redis';

interface TinybirdResponse<T> {
  data: T[];
}

const agent = new Agent({ keepAlive: true });

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
  // const start = new Date();
  const res = await fetch(url, { agent });
  const body: TinybirdResponse<{ post_id: string }> = await res.json();
  // console.log(
  //   `[feed_v2] fetch from tinybird ${
  //     new Date().getTime() - start.getTime()
  //   }ms (${url})`,
  // );
  return body.data;
}

export const getPersonalizedFeedKey = (
  userId?: string,
  feedId?: string,
): string => `feeds:${feedId || 'global'}:${userId || 'anonymous'}`;

const ONE_DAY_SECONDS = 24 * 60 * 60;

async function fetchAndCacheFeed(
  con: Connection,
  pageSize: number,
  userId?: string,
  feedId?: string,
): Promise<{ post_id: string }[]> {
  const key = getPersonalizedFeedKey(userId, feedId);
  const postIds = await fetchTinybirdFeed(con, pageSize, userId, feedId);
  // Don't wait for caching the feed to serve quickly
  setTimeout(async () => {
    const pipeline = redisClient.pipeline();
    pipeline.del(key);
    pipeline.set(`${key}:time`, new Date().toISOString());
    pipeline.expire(key, ONE_DAY_SECONDS);
    postIds.forEach(({ post_id }, i) => pipeline.zadd(key, i, post_id));
    await pipeline.exec();
    console.log(`set cache for ${key}`);
  });
  return postIds;
}

const shouldServeFromCache = async (
  offset: number,
  key: string,
): Promise<boolean> => {
  if (offset) {
    return true;
  }
  const lastGenerated = await redisClient.get(`${key}:time`);
  return (
    lastGenerated &&
    new Date().getTime() - new Date(lastGenerated).getTime() <= 3 * 60 * 1000
  );
  // return !key;
};

export async function generatePersonalizedFeed(
  con: Connection,
  pageSize: number,
  offset: number,
  userId?: string,
  feedId?: string,
): Promise<string[]> {
  try {
    const key = getPersonalizedFeedKey(userId, feedId);
    const idsPromise = redisClient.zrange(key, offset, pageSize + offset - 1);
    if (await shouldServeFromCache(offset, key)) {
      const postIds = await idsPromise;
      if (postIds.length) {
        return postIds;
      }
    }
  } catch (err) {
    console.error(err, 'failed to get feed from redis');
  }
  const postIds = await fetchAndCacheFeed(con, pageSize, userId, feedId);
  return postIds.slice(offset, pageSize + offset).map(({ post_id }) => post_id);
}
