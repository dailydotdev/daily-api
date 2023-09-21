import { FeedConfig, FeedConfigGenerator } from './types';
import { feedToFilters } from '../../common';
import { ISnotraClient, UserState } from '../snotra';

type Options = {
  includeAllowedTags?: boolean;
  includeBlockedTags?: boolean;
  includeBlockedSources?: boolean;
  includeSourceMemberships?: boolean;
};

type BaseConfig = Partial<Omit<FeedConfig, 'user_id' | 'page_size' | 'offset'>>;

function getDefaultConfig(
  baseConfig: BaseConfig,
  userId: string | undefined,
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
  };
  if (userId) {
    config.user_id = userId;
  }
  return config;
}

export class SimpleFeedConfigGenerator implements FeedConfigGenerator {
  private readonly baseConfig: BaseConfig;

  constructor(baseConfig: BaseConfig) {
    this.baseConfig = baseConfig;
  }

  async generate(ctx, userId, pageSize, offset): Promise<FeedConfig> {
    return getDefaultConfig(this.baseConfig, userId, pageSize, offset);
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

  async generate(ctx, userId, pageSize, offset): Promise<FeedConfig> {
    const config = getDefaultConfig(this.baseConfig, userId, pageSize, offset);
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

  async generate(ctx, userId, pageSize, offset): Promise<FeedConfig> {
    const userState = await this.snotraClient.fetchUserState({
      user_id: userId,
      providers: { personalise: {} },
    });
    return this.generators[userState.personalise.state].generate(
      ctx,
      userId,
      pageSize,
      offset,
    );
  }
}
