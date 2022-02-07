import { Agent } from 'https';
import { Connection } from 'typeorm';
import { feedToFilters } from './common';
import fetch from 'node-fetch';
import { redisClient } from './redis';
import { Context } from './Context';
import { runInSpan } from './trace';

interface TinybirdResponse<T> {
  data: T[];
}

const agent = new Agent({ keepAlive: true });

export async function fetchTinybirdFeed(
  con: Connection,
  pageSize: number,
  feedVersion: number,
  userId?: string,
  feedId?: string,
  ctx?: Context,
  enableSettingsExperiment?: boolean,
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
      () => feedToFilters(con, feedId, userId, enableSettingsExperiment),
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
        feedVersion < 6
          ? process.env.TINYBIRD_FEED
          : process.env.TINYBIRD_FEED_V3;
      const res = await fetch(`${url}&${params}`, {
        agent,
      });
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
  con: Connection,
  pageSize: number,
  feedVersion: number,
  userId?: string,
  feedId?: string,
  ctx?: Context,
  enableSettingsExperiment?: boolean,
): Promise<string[]> {
  const key = getPersonalizedFeedKey(userId, feedId);
  const rawPostIds = await fetchTinybirdFeed(
    con,
    pageSize,
    feedVersion,
    userId,
    feedId,
    ctx,
    enableSettingsExperiment,
  );
  // Don't wait for caching the feed to serve quickly
  if (rawPostIds?.length) {
    const postIds = rawPostIds.map(({ post_id }) => post_id);
    setTimeout(async () => {
      const pipeline = redisClient.pipeline();
      pipeline.set(
        `${key}:time`,
        new Date().toISOString(),
        'ex',
        ONE_DAY_SECONDS,
      );
      pipeline.set(
        `${key}:posts`,
        JSON.stringify(postIds),
        'ex',
        ONE_DAY_SECONDS,
      );
      await pipeline.exec();
    });
    return postIds;
  }
  return [];
}

const shouldServeFromCache = async (
  offset: number,
  key: string,
  feedId?: string,
): Promise<boolean> => {
  if (offset) {
    return true;
  }
  const updateKey = `${getPersonalizedFeedKeyPrefix(feedId)}:update`;
  const [lastGenerated, lastUpdated] = await redisClient.mget(
    `${key}:time`,
    updateKey,
  );
  return !(
    !lastGenerated ||
    (lastUpdated && lastUpdated > lastGenerated) ||
    new Date().getTime() - new Date(lastGenerated).getTime() > 3 * 60 * 1000
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
  enableSettingsExperiment,
}: {
  con: Connection;
  pageSize: number;
  offset: number;
  feedVersion: number;
  userId?: string;
  feedId?: string;
  ctx?: Context;
  enableSettingsExperiment?: boolean;
}): Promise<string[]> {
  try {
    const key = getPersonalizedFeedKey(userId, feedId);
    const idsPromise = redisClient.get(`${key}:posts`);
    if (
      await runInSpan(
        ctx?.span,
        'Feed_v2.shouldServeFromCache',
        () => shouldServeFromCache(offset, key, feedId),
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
    enableSettingsExperiment,
  );
  return postIds.slice(offset, pageSize + offset);
}
