import { feedToFilters } from './common';
import fetch from 'node-fetch';
import pRetry, { AbortError } from 'p-retry';
import { Context } from './Context';
import { runInSpan } from './trace';
import { ioRedisPool } from './redis';
import { DataSource } from 'typeorm';
import { fetchOptions } from './http';

interface TinybirdResponse<T> {
  data: T[];
}

export enum FeedConfigName {
  Personalise = 'personalise',
  Vector = 'vector',
}

const FeedVersionToConfigMap = {
  11: FeedConfigName.Personalise,
  14: FeedConfigName.Vector,
};

interface FeedParams {
  page_size: number;
  fresh_page_size: string;
  feed_config_name: FeedConfigName;
  total_pages: number;
  user_id?: string;
  feed_id?: string;
  allowed_tags?: string[];
  blocked_tags?: string[];
  blocked_sources?: string[];
  squad_ids?: string[];
}

const feedVersionToFeedConfigName = (feedVersion?: number): FeedConfigName => {
  if (!feedVersion || feedVersion < 11) {
    return FeedConfigName.Personalise;
  }

  return FeedVersionToConfigMap[feedVersion] ?? FeedConfigName.Personalise;
};

export async function fetchTinybirdFeed(
  con: DataSource,
  pageSize: number,
  feedVersion?: number,
  userId?: string,
  feedId?: string,
  ctx?: Context,
): Promise<{ post_id: string; metadata: Record<string, string> }[]> {
  const feedConfigName = feedVersionToFeedConfigName(feedVersion);

  const freshPageSize = Math.ceil(pageSize / 3).toFixed(0);
  const params: FeedParams = {
    page_size: pageSize,
    fresh_page_size: freshPageSize,
    feed_config_name: feedConfigName,
    total_pages: 40,
  };
  if (userId) {
    params.user_id = userId;
  }
  if (feedId) {
    params.feed_id = feedId;
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
      const value = filters.includeTags;
      params.allowed_tags = value;
    }
    if (filters.blockedTags?.length) {
      const value = filters.blockedTags;
      params.blocked_tags = value;
    }
    if (filters.excludeSources?.length) {
      const value = filters.excludeSources;
      params.blocked_sources = value;
    }
    if (filters.sourceIds?.length) {
      const value = filters.sourceIds;
      params.squad_ids = value;
    }
  } else {
    params.feed_id = 'global';
  }
  const body: TinybirdResponse<{
    post_id: string;
    metadata: Record<string, string>;
  }> = await pRetry(
    () =>
      runInSpan(
        ctx?.span,
        'Feed_v2.fetchTinybirdFeed',
        async () => {
          const url = process.env.INTERNAL_FEED;
          const res = await fetch(url, {
            ...fetchOptions,
            method: 'POST',
            body: JSON.stringify(params),
          });
          if (res.status >= 200 && res.status < 300) {
            const bodyText = await res.text();
            return JSON.parse(bodyText);
          }
          if (res.status < 500) {
            throw new AbortError(
              `feed service request is invalid: ${res.status}`,
            );
          }
          throw new Error(
            `unexpecetd response from feed service: ${res.status}`,
          );
        },
        { params },
      ),
    { retries: 5 },
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
  feedVersion?: number,
  userId?: string,
  feedId?: string,
  ctx?: Context,
): Promise<[string, string | undefined][]> {
  const key = getPersonalizedFeedKey(userId, feedId);
  const rawResponse = await fetchTinybirdFeed(
    con,
    pageSize,
    feedVersion,
    userId,
    feedId,
    ctx,
  );
  // Don't wait for caching the feed to serve quickly
  if (rawResponse?.length) {
    const ret: [string, string | undefined][] = rawResponse.map(
      ({ post_id, metadata }) => [
        post_id,
        metadata && JSON.stringify(metadata),
      ],
    );
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
          JSON.stringify(ret),
          'EX',
          ONE_DAY_SECONDS,
        );
        return await pipeline.exec();
      });
    });
    return ret;
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
}): Promise<[string, string | undefined][]> {
  try {
    const key = getPersonalizedFeedKey(userId, feedId);
    const cachePromise = ioRedisPool.execute(async (client) => {
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
      const cachedFeed = JSON.parse(await cachePromise);
      if (cachedFeed?.length) {
        const page: string[] | [string, string | undefined][] =
          cachedFeed.slice(offset, pageSize + offset);
        // Support legacy cache that contains only post id
        if (page.length && typeof page[0] === 'string') {
          return (page as string[]).map((postId) => [postId, undefined]);
        }
        return page as [string, string | undefined][];
      }
    }
  } catch (err) {
    console.error(err, 'failed to get feed from redis');
  }
  const feedRes = await fetchAndCacheFeed(
    con,
    pageSize,
    feedVersion,
    userId,
    feedId,
    ctx,
  );
  return feedRes.slice(offset, pageSize + offset);
}
