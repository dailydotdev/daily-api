import {
  ChannelFeedOptions,
  FeedConfig,
  FeedConfigName,
  FeedResponse,
  IFeedClient,
  BriefingModel,
} from './types';
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

  async fetchChannelFeed(
    ctx: unknown,
    options: ChannelFeedOptions,
  ): Promise<FeedResponse> {
    const body: Record<string, unknown> = {
      feed_config_name: FeedConfigName.Channel,
      channel: options.channel,
      order_by: 'date',
      page_size: options.pageSize,
      cursor: options.cursor,
    };

    if (options.contentCuration) {
      body.allowed_content_curations = [options.contentCuration];
    }

    if (options.allowedPostTypes?.length) {
      body.allowed_post_types = options.allowedPostTypes;
    }

    const res = await this.garmr.execute(() => {
      return fetchParse<RawFeedServiceResponse>(this.url, {
        ...this.fetchOptions,
        method: 'POST',
        body: JSON.stringify(body),
      });
    });

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

  async getUserBrief({
    userId,
    frequency,
    modelName = BriefingModel.Default,
    allowedTags,
    seniorityLevel,
    recentBriefing,
  }: UserBriefingRequest): Promise<Briefing> {
    const result = await this.garmr.execute(() => {
      return fetchParse<JsonValue>(`${this.url}/api/user/briefing`, {
        ...this.fetchOptions,
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          frequency,
          model_name: modelName,
          allowed_tags: allowedTags,
          seniority_level: seniorityLevel,
          recent_briefing: recentBriefing
            ? {
                sections: recentBriefing.sections,
                brief_statistics: recentBriefing.briefStatistics
                  ? {
                      posts: recentBriefing.briefStatistics.posts,
                      sources: recentBriefing.briefStatistics.sources,
                      saved_time: recentBriefing.briefStatistics.savedTime,
                    }
                  : undefined,
                reading_time: recentBriefing.readingTime,
                source_ids: recentBriefing.sourceIds,
              }
            : undefined,
        }),
      });
    });

    return Briefing.fromJson(result);
  }

  async getBriefLastUpdate(): Promise<{ updatedAt: Date }> {
    const result = await this.garmr.execute(() => {
      return fetchParse<{ last_update_time: string }>(
        `${this.url}/api/briefing/last-update-time`,
        {
          ...this.fetchOptions,
          method: 'GET',
        },
      );
    });

    const updatedAt = new Date(result.last_update_time);

    if (Number.isNaN(updatedAt.getTime())) {
      throw new Error('Invalid last update time');
    }

    return {
      updatedAt,
    };
  }
}
