import { DynamicConfig, FeedConfig, FeedConfigGenerator } from './types';
import { feedToFilters } from '../../common';
import { ISnotraClient, UserState } from '../snotra';
import { postTypes } from '../../entity';

type Options = {
  includeAllowedTags?: boolean;
  includeBlockedTags?: boolean;
  includeBlockedSources?: boolean;
  includeSourceMemberships?: boolean;
  includePostTypes?: boolean;
};

type BaseConfig = Partial<Omit<FeedConfig, 'user_id' | 'page_size' | 'offset'>>;

function getDefaultConfig(
  baseConfig: BaseConfig,
  dynamicConfig: DynamicConfig,
): FeedConfig {
  const freshPageSize = Math.ceil(dynamicConfig.page_size / 3).toFixed(0);
  const config: FeedConfig = {
    ...baseConfig,
    ...dynamicConfig,
    total_pages: baseConfig.total_pages || 1,
    fresh_page_size: freshPageSize,
  };
  if (config.user_id === null) {
    delete config.user_id;
  }
  return config;
}

export class SimpleFeedConfigGenerator implements FeedConfigGenerator {
  private readonly baseConfig: BaseConfig;

  constructor(baseConfig: BaseConfig) {
    this.baseConfig = baseConfig;
  }

  async generate(ctx, opts): Promise<FeedConfig> {
    return getDefaultConfig(this.baseConfig, opts);
  }
}

/**
 * Generates config based on the feed preferences (allow/block tags/sources)
 */
export class FeedPreferencesConfigGenerator implements FeedConfigGenerator {
  private readonly baseConfig: BaseConfig;
  private readonly opts: Options;

  constructor(baseConfig: BaseConfig, opts: Options = {}) {
    this.baseConfig = baseConfig;
    this.opts = opts;
  }

  async generate(ctx, opts): Promise<FeedConfig> {
    const config = getDefaultConfig(this.baseConfig, opts);
    const userId = opts.user_id;
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
    if (filters.excludeTypes?.length && this.opts.includePostTypes) {
      config.allowed_post_types = (
        config.allowed_post_types || postTypes
      ).filter((x) => !filters.excludeTypes.includes(x));
    }
    return config;
  }
}

/**
 * Generates config based on the user state (personalised/non-personalised)
 */
export class FeedUserStateConfigGenerator implements FeedConfigGenerator {
  private readonly snotraClient: ISnotraClient;
  private readonly generators: Record<UserState, FeedConfigGenerator>;

  constructor(
    snotraClient: ISnotraClient,
    generators: Record<UserState, FeedConfigGenerator>,
  ) {
    this.snotraClient = snotraClient;
    this.generators = generators;
  }

  async generate(ctx, opts): Promise<FeedConfig> {
    const userState = await this.snotraClient.fetchUserState({
      user_id: opts.user_id,
      providers: { personalise: {} },
    });
    return this.generators[userState.personalise.state].generate(ctx, opts);
  }
}
