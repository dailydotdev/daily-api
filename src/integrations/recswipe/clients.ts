import { RequestInit } from 'node-fetch';
import { fetchOptions as globalFetchOptions } from '../../http';
import { GarmrNoopService, GarmrService, IGarmrService } from '../garmr';
import { retryFetchParse } from '../retry';
import type {
  DiscoverPostsParams,
  DiscoverPostsResponse,
  ExtractTagsParams,
  ExtractTagsResponse,
  RawDiscoverPostsRequest,
  RawExtractTagsRequest,
  RawRecommendTagsRequest,
  RecommendTagsParams,
  RecommendTagsResponse,
} from './types';

export class RecswipeClient {
  private readonly fetchOptions: RequestInit;
  private readonly garmr: IGarmrService;

  constructor(
    private readonly url: string | undefined,
    options?: {
      fetchOptions?: RequestInit;
      garmr?: IGarmrService;
    },
  ) {
    const {
      fetchOptions = globalFetchOptions,
      garmr = new GarmrNoopService(),
    } = options || {};

    this.fetchOptions = fetchOptions;
    this.garmr = garmr;
  }

  discoverPosts(
    userId: string | undefined,
    params: DiscoverPostsParams,
  ): Promise<DiscoverPostsResponse> {
    if (!this.url) {
      throw new Error('Missing RECSWIPE_ORIGIN');
    }

    const body: RawDiscoverPostsRequest = {
      prompt: params.prompt ?? '',
      selected_tags: params.selectedTags ?? [],
      confirmed_tags: params.confirmedTags ?? [],
      liked_titles: params.likedTitles ?? [],
      exclude_ids: params.excludeIds ?? [],
      saturated_tags: params.saturatedTags ?? [],
      n: params.n ?? 8,
    };

    return this.garmr.execute(() =>
      retryFetchParse<DiscoverPostsResponse>(`${this.url}/api/discover-posts`, {
        ...this.fetchOptions,
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'X-User-Id': userId } : {}),
        },
      }),
    );
  }

  extractTags(
    userId: string | undefined,
    params: ExtractTagsParams,
  ): Promise<ExtractTagsResponse> {
    if (!this.url) {
      throw new Error('Missing RECSWIPE_ORIGIN');
    }

    const body: RawExtractTagsRequest = {
      prompt: params.prompt,
    };

    return this.garmr.execute(() =>
      retryFetchParse<ExtractTagsResponse>(`${this.url}/api/extract-tags`, {
        ...this.fetchOptions,
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'X-User-Id': userId } : {}),
        },
      }),
    );
  }

  recommendTags(
    userId: string | undefined,
    params: RecommendTagsParams,
  ): Promise<RecommendTagsResponse> {
    if (!this.url) {
      throw new Error('Missing RECSWIPE_ORIGIN');
    }

    const body: RawRecommendTagsRequest = {
      selected_tags: params.selectedTags,
      n: params.n ?? 20,
    };

    return this.garmr.execute(() =>
      retryFetchParse<RecommendTagsResponse>(`${this.url}/api/recommend-tags`, {
        ...this.fetchOptions,
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'X-User-Id': userId } : {}),
        },
      }),
    );
  }
}

export const recswipeClient = new RecswipeClient(process.env.RECSWIPE_ORIGIN, {
  garmr: new GarmrService({
    service: RecswipeClient.name,
    breakerOpts: {
      halfOpenAfter: 5 * 1000,
      threshold: 0.1,
      duration: 10 * 1000,
    },
  }),
});
