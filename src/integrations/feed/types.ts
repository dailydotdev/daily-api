import { Context } from '../../Context';

export type FeedResponse = [postId: string, metadata: string | undefined][];

export type FeedProvider = {
  enable?: boolean;
  remove_engaged_posts?: boolean;
  page_size_fraction: number;
  penalise_source?: boolean;
  penalise_source_seed?: number;
  fallback_provider?: string;
};

export type PersonalizedProvider = FeedProvider & {
  content_factor: {
    tag_rank?: boolean;
    source_rank?: boolean;
    content_curation_rank?: boolean;
  };
};

export type VectorSimilarityProvider = FeedProvider & {
  disable_vector_search_cache?: boolean;
};

export type FeedConfig = {
  feed_id: string;
  user_id?: string;
  feed_config_name?: string;
  page_size: number;
  offset: number;
  total_pages: number;
  fresh_page_size?: string;
  allowed_tags?: string[];
  blocked_tags?: string[];
  blocked_sources?: string[];
  squad_ids?: string[];
  providers?: Record<string, FeedProvider>;
};

export interface FeedConfigGenerator {
  generate(
    ctx: Context,
    userId: string | undefined,
    feedId: string | undefined,
    pageSize: number,
    offset: number,
  ): Promise<FeedConfig>;
}

/**
 * An interface for a feed service client
 */
export interface IFeedClient {
  /**
   * Fetches the feed from the service
   * @param ctx GraphQL context
   * @param feedId The feed ID (user id for my feed and fixed value for the rest)
   * @param config The feed config
   */
  fetchFeed(
    ctx: Context,
    feedId: string | undefined,
    config: FeedConfig,
  ): Promise<FeedResponse>;
}
