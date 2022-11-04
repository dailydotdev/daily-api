import { feedToFilters } from './common';
import fetch from 'node-fetch';
import { Context } from './Context';
import { runInSpan } from './trace';
import http from 'node:http';
import https from 'node:https';
import { ioRedisPool } from './redis';
import { DataSource } from 'typeorm';

interface TinybirdResponse<T> {
  data: T[];
}

const fetchOptions = {
  agent: (parsedURL) => {
    if (parsedURL.protocol == 'http:') {
      return new http.Agent({
        keepAlive: true,
      });
    } else {
      return new https.Agent({
        keepAlive: true,
      });
    }
  },
};

export async function fetchTinybirdFeed(
  con: DataSource,
  pageSize: number,
  feedVersion: number,
  userId?: string,
  feedId?: string,
  ctx?: Context,
): Promise<{ post_id: string }[]> {
  const freshPageSize = Math.ceil(pageSize / 3).toFixed(0);
  let params = `page_size=${pageSize}&fresh_page_size=${freshPageSize}&feed_version=${feedVersion}`;
  if (userId) {
    params += `&user_id=${userId}`;
  }
  if (feedId) {
    params += `&feed_id=${feedId}`;
    const filters = await runInSpan(
      ctx?.span,
      'Feed_v2.feedToFilters',
      () => feedToFilters(con, feedId, userId),
      {
        feedId,
        userId,
      },
    );
    if (filters.includeTags?.length) {
      params += `&allowed_tags=${filters.includeTags.join(',')}`;
    }
    if (filters.blockedTags?.length) {
      params += `&blocked_tags=${filters.blockedTags.join(',')}`;
    }
    if (filters.excludeSources?.length) {
      params += `&blocked_sources=${filters.excludeSources.join(',')}`;
    }
  } else {
    params += `&feed_id=global`;
  }
  const body: TinybirdResponse<{ post_id: string }> = await runInSpan(
    ctx?.span,
    'Feed_v2.fetchTinybirdFeed',
    async () => {
      const url =
        feedVersion === 9
          ? process.env.INTERNAL_FEED
          : feedVersion !== 6
          ? process.env.TINYBIRD_FEED
          : process.env.TINYBIRD_FEED_V3;
      const res = await fetch(`${url}&${params}`, fetchOptions);
      return res.json();
    },
    { params, feedVersion },
  );
  if (!body.data.length) {
    ctx?.log.warn(
      {
        params,
        userId,
        feedId,
      },
      'empty response received from tinybird',
    );
  }
  return body.data;
}

export const getPersonalizedFeedKeyPrefix = (feedId?: string): string =>
  `feeds:${feedId || 'global'}`;

export const getPersonalizedFeedKey = (
  userId?: string,
  feedId?: string,
): string => `${getPersonalizedFeedKeyPrefix(feedId)}:${userId || 'anonymous'}`;

const ONE_DAY_SECONDS = 24 * 60 * 60;

async function fetchAndCacheFeed(
  con: DataSource,
  pageSize: number,
  feedVersion: number,
  userId?: string,
  feedId?: string,
  ctx?: Context,
): Promise<string[]> {
  const key = getPersonalizedFeedKey(userId, feedId);
  const rawPostIds = await fetchTinybirdFeed(
    con,
    pageSize,
    feedVersion,
    userId,
    feedId,
    ctx,
  );
  // Don't wait for caching the feed to serve quickly
  if (rawPostIds?.length) {
    const postIds = rawPostIds.map(({ post_id }) => post_id);
    setTimeout(async () => {
      await ioRedisPool.execute(async (client) => {
        const pipeline = client.pipeline();
        pipeline.set(
          `${key}:time`,
          new Date().toISOString(),
          'EX',
          ONE_DAY_SECONDS,
        );
        pipeline.set(
          `${key}:posts`,
          JSON.stringify(postIds),
          'EX',
          ONE_DAY_SECONDS,
        );
        return await pipeline.exec();
      });
    });
    return postIds;
  }
  return [];
}

const shouldServeFromCache = async (
  offset: number,
  key: string,
  feedVersion: number,
  feedId?: string,
): Promise<boolean> => {
  if (offset) {
    return true;
  }
  const updateKey = `${getPersonalizedFeedKeyPrefix(feedId)}:update`;
  const [lastGenerated, lastUpdated] = await ioRedisPool.execute(
    async (client) => {
      return client.mget(`${key}:time`, updateKey);
    },
  );
  const ttl = feedVersion != 8 ? 3 * 60 * 1000 : 60 * 1000;
  return !(
    !lastGenerated ||
    (lastUpdated && lastUpdated > lastGenerated) ||
    new Date().getTime() - new Date(lastGenerated).getTime() > ttl
  );
  // return !key;
};

export async function generatePersonalizedFeed({
  con,
  pageSize,
  offset,
  feedVersion,
  userId,
  feedId,
  ctx,
}: {
  con: DataSource;
  pageSize: number;
  offset: number;
  feedVersion: number;
  userId?: string;
  feedId?: string;
  ctx?: Context;
}): Promise<string[]> {
  try {
    const key = getPersonalizedFeedKey(userId, feedId);
    const idsPromise = ioRedisPool.execute(async (client) => {
      return client.get(`${key}:posts`);
    });
    if (
      await runInSpan(
        ctx?.span,
        'Feed_v2.shouldServeFromCache',
        () => shouldServeFromCache(offset, key, feedVersion, feedId),
        {
          offset,
          key,
          feedId,
        },
      )
    ) {
      const postIds = JSON.parse(await idsPromise);
      if (postIds?.length) {
        return postIds.slice(offset, pageSize + offset);
      }
    }
  } catch (err) {
    console.error(err, 'failed to get feed from redis');
  }
  const postIds = await fetchAndCacheFeed(
    con,
    pageSize,
    feedVersion,
    userId,
    feedId,
    ctx,
  );
  return postIds.slice(offset, pageSize + offset);
}
