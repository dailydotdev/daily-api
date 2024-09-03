import { FeedResponse, IFeedClient } from './types';
import { RequestInit } from 'node-fetch';
import { fetchOptions as globalFetchOptions } from '../../http';
import { retryFetchParse } from '../retry';
import { GenericMetadata } from '../lofn';
import { GarmrService, IGarmrClient } from '../garmr';

type RawFeedServiceResponse = {
  data: { post_id: string; metadata: Record<string, string> }[];
  cursor?: string;
};

type FeedFetchOptions = RequestInit & {
  retries?: number;
};

/**
 * Naive implementation of a feed client that fetches the feed from the feed service
 */
export class FeedClient implements IFeedClient, IGarmrClient {
  private readonly url: string;
  private readonly fetchOptions: FeedFetchOptions;
  private static readonly garmr = new GarmrService({
    service: FeedClient.name,
    breakerOpts: {
      halfOpenAfter: 3 * 1000,
      threshold: 0.1,
      duration: 30 * 1000,
    },
  });

  get garmr() {
    return FeedClient.garmr;
  }

  constructor(
    url = process.env.INTERNAL_FEED,
    fetchOptions: FeedFetchOptions = globalFetchOptions,
  ) {
    this.url = url;
    this.fetchOptions = fetchOptions;
  }

  async fetchFeed(
    ctx,
    feedId,
    config,
    extraMetadata: GenericMetadata = undefined,
  ): Promise<FeedResponse> {
    const res = await this.garmr.execute(() => {
      return retryFetchParse<RawFeedServiceResponse>(
        this.url,
        {
          ...this.fetchOptions,
          method: 'POST',
          body: JSON.stringify(config),
        },
        { retries: 0 },
      );
    });

    if (!res?.data?.length) {
      return { data: [] };
    }
    return {
      data: res.data.map(({ post_id, metadata }) => {
        const hasMetadata = !!(metadata || extraMetadata);

        return [
          post_id,
          (hasMetadata &&
            JSON.stringify({
              ...metadata,
              ...extraMetadata,
            })) ||
            null,
        ];
      }),
      cursor: res.cursor,
    };
  }
}
