import { Context } from '../../Context';
import type { FeedFlags } from '../../entity';
import { GenericMetadata } from '../lofn';

export type FeedResponse = {
  data: [postId: string, metadata: string | null][];
  cursor?: string;
};

export enum FeedConfigName {
  Personalise = 'personalise',
  Channel = 'channel',
  Vector = 'vector',
  Onboarding = 'onboarding',
  PersonaliseV27 = 'personalise_v27',
  VectorV26 = 'vector_v26',
  VectorV27 = 'vector_v27',
  PostSimilarity = 'post_similarity',
  CustomFeedV1 = 'custom_feed_v1',
  Popular = 'popular',
  // currently used when sorting custom feed by other option then recommended
  CustomFeedNaV1 = 'custom_feed_na_v1',
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
  channel?: string;
  page_size: number;
  offset?: number;
  total_pages: number;
  fresh_page_size?: string;
  allowed_tags?: string[];
  blocked_tags?: string[];
  allowed_sources?: string[];
  blocked_sources?: string[];
  allowed_post_types?: string[];
  allowed_content_curations?: string[];
  blocked_title_words?: string[];
  allowed_author_ids?: string[];
  blocked_author_ids?: string[];
  followed_user_ids?: string[];
  followed_sources?: string[];
  squad_ids?: string[];
  providers?: Record<string, FeedProvider>;
  source_types?: ('machine' | 'squad' | 'user')[];
  cursor?: string;
  post_id?: string;
  allowed_languages?: string[];
  config?: {
    [key: string]: unknown;
  };
} & FeedFlagsFilters;

export type DynamicConfig = Omit<FeedConfig, 'total_pages'>;

export type FeedConfigGeneratorResult = {
  config: FeedConfig;
  extraMetadata?: GenericMetadata;
};

export interface FeedConfigGenerator {
  generate(
    ctx: Context,
    opts: DynamicConfig,
  ): Promise<FeedConfigGeneratorResult>;
}

export type ChannelFeedOptions = {
  channel: string;
  contentCuration?: string;
  pageSize: number;
  cursor?: string;
  allowedPostTypes?: string[];
};

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
    extraMetadata?: GenericMetadata,
  ): Promise<FeedResponse>;
}

export type FeedVersion =
  | '26'
  | '29'
  | 'popular'
  | 'onboarding'
  | 'post_similarity'
  | '30'
  | 'f1'
  | 'time';

export const baseFeedConfig: Partial<FeedConfig> = {
  source_types: ['machine', 'squad', 'user'],
  allowed_languages: ['en'],
};

export type FeedFlagsFilters = {
  order_by?: FeedFlags['orderBy'];
  disable_engagement_filter?: FeedFlags['disableEngagementFilter'];
  min_thresholds?: {
    upvotes?: FeedFlags['minUpvotes'];
    views?: FeedFlags['minViews'];
  };
  min_day_range?: FeedFlags['minDayRange'];
};

export enum BriefingType {
  Daily = 'daily',
  Weekly = 'weekly',
}

export enum BriefingModel {
  Default = 'ai_briefing',
}
