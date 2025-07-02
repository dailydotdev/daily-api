import { FeedConfig, FeedResponse, IFeedClient, BriefingModel } from './types';
import { RequestInit } from 'node-fetch';
import { fetchOptions as globalFetchOptions } from '../../http';
import { fetchParse } from '../retry';
import { GenericMetadata } from '../lofn';
import { GarmrNoopService, IGarmrClient, IGarmrService } from '../garmr';
import { Briefing, UserBriefingRequest } from '@dailydotdev/schema';
import type { JsonValue } from '@bufbuild/protobuf';

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
  readonly garmr: IGarmrService;

  constructor(
    url = process.env.INTERNAL_FEED,
    options?: {
      fetchOptions?: FeedFetchOptions;
      garmr?: IGarmrService;
    },
  ) {
    const {
      fetchOptions = globalFetchOptions,
      garmr = new GarmrNoopService(),
    } = options || {};

    this.url = url;
    this.fetchOptions = fetchOptions;
    this.garmr = garmr;
  }

  async fetchFeed(
    ctx: unknown,
    feedId: string,
    config: FeedConfig,
    extraMetadata?: GenericMetadata,
  ): Promise<FeedResponse> {
    const res = await this.garmr.execute(() => {
      return fetchParse<RawFeedServiceResponse>(this.url, {
        ...this.fetchOptions,
        method: 'POST',
        body: JSON.stringify(config),
      });
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

  async getUserBrief({
    userId,
    frequency,
    modelName = BriefingModel.Default,
  }: UserBriefingRequest): Promise<Briefing> {
    const result = await this.garmr.execute(() => {
      return fetchParse<JsonValue>(`${this.url}/api/user/briefing`, {
        ...this.fetchOptions,
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          frequency,
          model_name: modelName,
        }),
      });
    });

    return Briefing.fromJson(result);
  }
}
