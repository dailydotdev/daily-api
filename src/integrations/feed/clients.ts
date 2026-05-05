import { FeedConfig, FeedResponse, IFeedClient, BriefingModel } from './types';
import fetch, { RequestInit } from 'node-fetch';
import { fetchOptions as globalFetchOptions } from '../../http';
import { fetchParse } from '../retry';
import { GenericMetadata } from '../lofn';
import { GarmrNoopService, IGarmrClient, IGarmrService } from '../garmr';
import { Briefing, UserBriefingRequest } from '@dailydotdev/schema';
import type { JsonValue } from '@bufbuild/protobuf';
import { ServiceError } from '../../errors';

type RawFeedDataItem = {
  post_id: string;
  type?: string;
  highlight_ids?: string[];
  metadata: Record<string, string>;
};

type RawFeedServiceResponse = {
  data: RawFeedDataItem[];
  cursor?: string;
  stale_cursor?: boolean;
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
      data: res.data.map(({ post_id, type, highlight_ids, metadata }) => {
        const mergedMetadata = Object.fromEntries(
          Object.entries({
            ...metadata,
            ...extraMetadata,
          }).filter(([, value]) => value !== undefined),
        );
        const hasMetadata = Object.keys(mergedMetadata).length > 0;
        const feedMeta = hasMetadata ? JSON.stringify(mergedMetadata) : null;

        if (type === 'highlight') {
          return {
            type: 'highlight',
            highlightIds: highlight_ids || [],
            feedMeta,
          };
        }

        return {
          type: 'post',
          id: post_id,
          feedMeta,
        };
      }),
      cursor: res.cursor,
      staleCursor: res.stale_cursor,
    };
  }

  async getUserBrief(request: UserBriefingRequest): Promise<Briefing> {
    const {
      userId,
      frequency,
      modelName = BriefingModel.Default,
      allowedTags,
      blockedTags,
      seniorityLevel,
      recentBriefing,
    } = request;

    const result = await this.garmr.execute<JsonValue>(async () => {
      const response = await fetch(`${this.url}/api/user/briefing`, {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          frequency,
          model_name: modelName,
          allowed_tags: allowedTags,
          blocked_tags: blockedTags,
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

      const result = await response.json();

      if (!response.ok) {
        throw new ServiceError({
          message: 'Brief request to feed failed',
          data: result,
          statusCode: response.status,
        });
      }

      return result;
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
