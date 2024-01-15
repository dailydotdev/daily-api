import { Context } from '../../Context';

export type FeedResponse = {
  data: [postId: string, metadata: string | undefined][];
  cursor?: string;
};

export enum FeedConfigName {
  Personalise = 'personalise',
  PersonaliseOnboard = 'personalise_onboard',
  Vector = 'vector',
  Onboarding = 'onboarding',
  PersonaliseM3 = 'personalise_m3',
  PersonaliseV18 = 'personalise_v18',
  PersonaliseV20 = 'personalise_v20',
  VectorM3 = 'vector_m3',
  VectorE1 = 'vector_e1',
  VectorV18 = 'vector_v18',
  VectorV20 = 'vector_v20',
  VectorV21 = 'vector_v21',
  PostSimilarity = 'post_similarity',
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
  offset?: number;
  total_pages: number;
  fresh_page_size?: string;
  allowed_tags?: string[];
  blocked_tags?: string[];
  blocked_sources?: string[];
  squad_ids?: string[];
  providers?: Record<string, FeedProvider>;
  source_types?: ('machine' | 'squad')[];
  cursor?: string;
  post_id?: string;
};

export type DynamicConfig = Omit<FeedConfig, 'total_pages'>;

export interface FeedConfigGenerator {
  generate(ctx: Context, opts: DynamicConfig): Promise<FeedConfig>;
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

export type FeedVersion =
  | '20'
  | '21'
  | 'popular'
  | 'onboarding'
  | 'post_similarity';
