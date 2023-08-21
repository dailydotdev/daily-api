import { FeedConfig, FeedConfigGenerator } from './types';
import { feedToFilters } from '../../common';

type Options = {
  includeAllowedTags?: boolean;
  includeBlockedTags?: boolean;
  includeBlockedSources?: boolean;
  includeSourceMemberships?: boolean;
};

function getDefaultConfig(
  baseConfig: Partial<FeedConfig>,
  userId: string | undefined,
  feedId: string | undefined,
  pageSize: number,
  offset: number,
): FeedConfig {
  const freshPageSize = Math.ceil(pageSize / 3).toFixed(0);
  const config: FeedConfig = {
    ...baseConfig,
    page_size: pageSize,
    offset,
    total_pages: baseConfig.total_pages || 40,
    fresh_page_size: freshPageSize,
    feed_id: feedId || 'global',
  };
  if (userId) {
    config.user_id = userId;
  }
  return config;
}

export class SimpleFeedConfigGenerator implements FeedConfigGenerator {
  private readonly baseConfig: Partial<FeedConfig>;

  constructor(baseConfig: Partial<FeedConfig>) {
    this.baseConfig = baseConfig;
  }

  async generate(ctx, userId, feedId, pageSize, offset): Promise<FeedConfig> {
    return getDefaultConfig(this.baseConfig, userId, feedId, pageSize, offset);
  }
}

/**
 * Generates config based on the feed preferences (allow/block tags/sources)
 */
export class FeedPreferencesConfigGenerator implements FeedConfigGenerator {
  private readonly baseConfig: Partial<FeedConfig>;
  private readonly opts: Options;

  constructor(baseConfig: Partial<FeedConfig>, opts: Options = {}) {
    this.baseConfig = baseConfig;
    this.opts = opts;
  }

  async generate(ctx, userId, feedId, pageSize, offset): Promise<FeedConfig> {
    const config = getDefaultConfig(
      this.baseConfig,
      userId,
      feedId,
      pageSize,
      offset,
    );
    const filters = await feedToFilters(ctx.con, userId, userId);
    if (filters.includeTags?.length && this.opts.includeAllowedTags) {
      config.allowed_tags = filters.includeTags;
    }
    if (filters.blockedTags?.length && this.opts.includeBlockedTags) {
      config.blocked_tags = filters.blockedTags;
    }
    if (filters.excludeSources?.length && this.opts.includeBlockedSources) {
      config.blocked_sources = filters.excludeSources;
    }
    if (filters.sourceIds?.length && this.opts.includeSourceMemberships) {
      config.squad_ids = filters.sourceIds;
    }
    return config;
  }
}
