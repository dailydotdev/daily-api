import { FeedResponse, IFeedClient } from './types';
import { RequestInit } from 'node-fetch';
import { fetchOptions as globalFetchOptions } from '../../http';
import { retryFetchParse } from '../retry';

type RawFeedServiceResponse = {
  data: { post_id: string; metadata: Record<string, string> }[];
  cursor?: string;
};

/**
 * Naive implementation of a feed client that fetches the feed from the feed service
 */
export class FeedClient implements IFeedClient {
  private readonly url: string;
  private readonly fetchOptions: RequestInit;

  constructor(
    url = process.env.INTERNAL_FEED,
    fetchOptions: RequestInit = globalFetchOptions,
  ) {
    this.url = url;
    this.fetchOptions = fetchOptions;
  }

  async fetchFeed(ctx, feedId, config): Promise<FeedResponse> {
    const res = await retryFetchParse<RawFeedServiceResponse>(
      this.url,
      {
        ...this.fetchOptions,
        method: 'POST',
        body: JSON.stringify(config),
      },
      { retries: 5 },
    );
    if (!res?.data?.length) {
      return { data: [] };
    }
    return {
      data: res.data.map(({ post_id, metadata }) => [
        post_id,
        (metadata && JSON.stringify(metadata)) || null,
      ]),
      cursor: res.cursor,
    };
  }
}
