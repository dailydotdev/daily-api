import {
  DynamicConfig,
  FeedConfig,
  FeedConfigGenerator,
  FeedConfigGeneratorResult,
  FeedConfigName,
  FeedVersion,
} from './types';
import { AnonymousFeedFilters, feedToFilters } from '../../common';
import { postTypes } from '../../entity';
import { runInSpan } from '../../telemetry';
import { ILofnClient } from '../lofn';
import { Context } from '../../Context';

export type Options = {
  includeAllowedTags?: boolean;
  includeBlockedTags?: boolean;
  includeAllowedSources?: boolean;
  includeBlockedSources?: boolean;
  includeBlockedUsers?: boolean;
  includeAllowedUsers?: boolean;
  includeSourceMemberships?: boolean;
  includePostTypes?: boolean;
  includeContentCuration?: boolean;
  includeBlockedWords?: boolean;
  includeFollowedSources?: boolean;
  includeFollowedUsers?: boolean;
  feedId?: string;
};

type BaseConfig = Partial<Omit<FeedConfig, 'user_id' | 'page_size' | 'offset'>>;
const AllowedContentCurationTypes = [
  'news',
  'release',
  'opinion',
  'listicle',
  'comparison',
  'tutorial',
  'story',
  'meme',
] as const;

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

  async generate(
    ctx: Context,
    opts: DynamicConfig,
  ): Promise<FeedConfigGeneratorResult> {
    return {
      config: getDefaultConfig(this.baseConfig, opts),
    };
  }
}

const mergeSingleFilter = (
  base: string[] | undefined,
  filter: string[] | undefined,
): string[] | undefined => {
  if (!filter) {
    return base;
  }
  return base ? Array.from(new Set([...base, ...filter])) : filter;
};

const addFiltersToConfig = ({
  config,
  filters,
  opts,
}: {
  config: FeedConfig;
  filters: AnonymousFeedFilters;
  opts: Options;
}): FeedConfigGeneratorResult['config'] => {
  const baseConfig = { ...config, ...filters.flags };

  // if order_by is set we use the CustomFeedNaV1 config
  // for better results while sorting custom feeds
  if (
    baseConfig.feed_config_name === FeedConfigName.CustomFeedV1 &&
    baseConfig.order_by
  ) {
    baseConfig.feed_config_name = FeedConfigName.CustomFeedNaV1;
  }

  if (filters.includeTags?.length && opts.includeAllowedTags) {
    baseConfig.allowed_tags = mergeSingleFilter(
      baseConfig.allowed_tags,
      filters.includeTags,
    );
  }
  if (filters.blockedTags?.length && opts.includeBlockedTags) {
    baseConfig.blocked_tags = mergeSingleFilter(
      baseConfig.blocked_tags,
      filters.blockedTags,
    );
  }
  if (filters.excludeSources?.length && opts.includeBlockedSources) {
    baseConfig.blocked_sources = mergeSingleFilter(
      baseConfig.blocked_sources,
      filters.excludeSources,
    );
  }
  if (filters.sourceIds?.length && opts.includeSourceMemberships) {
    baseConfig.squad_ids = mergeSingleFilter(
      baseConfig.squad_ids,
      filters.sourceIds,
    );
  }
  if (filters.excludeTypes?.length && opts.includePostTypes) {
    baseConfig.allowed_post_types = (
      baseConfig.allowed_post_types || postTypes
    ).filter((x) => !filters.excludeTypes!.includes(x));
  }
  if (filters.excludeSourceTypes && baseConfig.source_types) {
    baseConfig.source_types = baseConfig.source_types.filter(
      (el) => !filters.excludeSourceTypes?.includes(el),
    );
  }
  if (filters.blockedContentCuration?.length && opts.includeContentCuration) {
    baseConfig.allowed_content_curations = mergeSingleFilter(
      baseConfig.allowed_content_curations,
      AllowedContentCurationTypes.filter(
        (type) => !filters.blockedContentCuration!.includes(type),
      ),
    );
  }
  if (filters.blockedWords?.length && opts.includeBlockedWords) {
    baseConfig.blocked_title_words = mergeSingleFilter(
      baseConfig.blocked_title_words,
      filters.blockedWords,
    );
  }
  if (filters.followingSources?.length && opts.includeFollowedSources) {
    baseConfig.followed_sources = mergeSingleFilter(
      baseConfig.followed_sources,
      filters.followingSources,
    );
  }
  if (filters.followingSources?.length && opts.includeAllowedSources) {
    baseConfig.allowed_sources = mergeSingleFilter(
      baseConfig.allowed_sources,
      filters.followingSources,
    );
  }
  if (filters.followingUsers?.length && opts.includeFollowedUsers) {
    baseConfig.followed_user_ids = mergeSingleFilter(
      baseConfig.followed_user_ids,
      filters.followingUsers,
    );
  }
  if (filters.followingUsers?.length && opts.includeAllowedUsers) {
    baseConfig.allowed_author_ids = mergeSingleFilter(
      baseConfig.allowed_author_ids,
      filters.followingUsers,
    );
  }

  if (filters.excludeUsers?.length && opts.includeBlockedUsers) {
    baseConfig.blocked_author_ids = mergeSingleFilter(
      baseConfig.blocked_author_ids,
      filters.excludeUsers,
    );
  }

  return baseConfig;
};

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

  async generate(
    ctx: Context,
    opts: DynamicConfig,
  ): Promise<FeedConfigGeneratorResult> {
    return runInSpan('FeedPreferencesConfigGenerator', async () => {
      const defaultConfig = getDefaultConfig(this.baseConfig, opts);
      const userId = opts.user_id;
      const feedId = this.opts.feedId || userId;
      const filters = await feedToFilters(ctx.con, feedId, userId);
      const config = addFiltersToConfig({
        config: defaultConfig,
        filters,
        opts: this.opts,
      });

      return { config };
    });
  }
}

type FeedLofnConfigGeneratorOptions = {
  feed_version: FeedVersion;
} & Options;

export class FeedLofnConfigGenerator implements FeedConfigGenerator {
  private readonly baseConfig: BaseConfig;
  private readonly lofnClient: ILofnClient;
  private readonly opts: FeedLofnConfigGeneratorOptions;
  private readonly feedPreferencesConfigGenerator: FeedPreferencesConfigGenerator;

  constructor(
    baseConfig: BaseConfig,
    lofnClient: ILofnClient,
    opts: FeedLofnConfigGeneratorOptions,
  ) {
    this.baseConfig = baseConfig;
    this.lofnClient = lofnClient;
    this.opts = opts;
    this.feedPreferencesConfigGenerator = new FeedPreferencesConfigGenerator(
      this.baseConfig,
      opts,
    );
  }

  async generate(
    ctx: Context,
    opts: DynamicConfig,
  ): Promise<FeedConfigGeneratorResult> {
    return runInSpan('FeedLofnConfigGenerator', async () => {
      try {
        const [lofnConfig, preferencesConfig] = await Promise.all([
          this.lofnClient.fetchConfig({
            user_id: opts.user_id!,
            feed_version: this.opts.feed_version,
            cursor: opts.cursor!,
          }),
          this.feedPreferencesConfigGenerator.generate(ctx, opts),
        ]);

        const config = {
          config: lofnConfig.config,
          ...lofnConfig.extra,
          ...preferencesConfig.config,
        };

        const result = {
          config,
          extraMetadata: {
            mab: lofnConfig.tyr_metadata,
          },
        };

        ctx.log.debug(
          {
            config: result.config,
            extraMetadata: result.extraMetadata,
            feedVersion: this.opts.feed_version,
            generator: 'FeedLofnConfigGenerator',
          },
          'Generated config result',
        );

        return result;
      } catch (error) {
        ctx.log.error(
          {
            err: error,
            userIdExists: !!opts.user_id,
            feedVersion: this.opts.feed_version,
            generator: 'FeedLofnConfigGenerator',
          },
          'Failed to generate feed config',
        );

        throw error;
      }
    });
  }
}

export class FeedLocalConfigGenerator implements FeedConfigGenerator {
  private readonly baseConfig: BaseConfig;
  private readonly opts: Omit<Options, 'feedId'> & {
    feedFilters?: AnonymousFeedFilters;
  };

  constructor(baseConfig: BaseConfig, opts = {}) {
    this.baseConfig = baseConfig;
    this.opts = opts;
  }

  async generate(
    ctx: Context,
    opts: DynamicConfig,
  ): Promise<FeedConfigGeneratorResult> {
    return runInSpan('FeedLocalConfigGenerator', async () => {
      const defaultConfig = getDefaultConfig(this.baseConfig, opts);
      const filters = this.opts.feedFilters || {};
      const config = addFiltersToConfig({
        config: defaultConfig,
        filters,
        opts: this.opts,
      });

      return { config };
    });
  }
}
