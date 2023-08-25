import { Context } from '../../Context';

export type FeedResponse = [postId: string, metadata: string | undefined][];

export enum FeedConfigName {
  Personalise = 'personalise',
  Vector = 'vector',
}

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
  user_id?: string;
  feed_config_name?: FeedConfigName;
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
   * @param feedId The feed ID (used for caching primarily)
   * @param config The feed config
   */
  fetchFeed(
    ctx: Context,
    feedId: string,
    config: FeedConfig,
  ): Promise<FeedResponse>;
}

export type FeedVersion = '11' | '14' | 'popular';
