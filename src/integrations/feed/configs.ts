import {
  DynamicConfig,
  FeedConfig,
  FeedConfigGenerator,
  FeedConfigGeneratorResult,
  FeedVersion,
} from './types';
import { feedToFilters } from '../../common';
import { ISnotraClient, UserState } from '../snotra';
import { postTypes } from '../../entity';
import { runInSpan } from '../../telemetry/opentelemetry';
import { ILofnClient } from '../lofn';
import { Context } from '../../Context';

type Options = {
  includeAllowedTags?: boolean;
  includeBlockedTags?: boolean;
  includeBlockedSources?: boolean;
  includeSourceMemberships?: boolean;
  includePostTypes?: boolean;
  includeBlockedContentCuration?: boolean;
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

  async generate(ctx, opts): Promise<FeedConfigGeneratorResult> {
    return {
      config: getDefaultConfig(this.baseConfig, opts),
    };
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

  async generate(ctx, opts): Promise<FeedConfigGeneratorResult> {
    return runInSpan('FeedPreferencesConfigGenerator', async () => {
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
      if (
        filters.blockedContentCuration?.length &&
        this.opts.includeBlockedContentCuration
      ) {
        config.blocked_content_curations = filters.blockedContentCuration;
      }
      return { config };
    });
  }
}

/**
 * Generates config based on the user state (personalised/non-personalised)
 */
export class FeedUserStateConfigGenerator implements FeedConfigGenerator {
  private readonly snotraClient: ISnotraClient;
  private readonly generators: Record<UserState, FeedConfigGenerator>;
  private readonly personalizationThreshold?: number;

  constructor(
    snotraClient: ISnotraClient,
    generators: Record<UserState, FeedConfigGenerator>,
    personalizationThreshold?: number,
  ) {
    this.snotraClient = snotraClient;
    this.generators = generators;
    this.personalizationThreshold = personalizationThreshold;
  }

  async generate(ctx, opts): Promise<FeedConfigGeneratorResult> {
    return runInSpan('FeedUserStateConfigGenerator', async () => {
      const userState = await this.snotraClient.fetchUserState({
        user_id: opts.user_id,
        providers: { personalise: {} },
        post_rank_count: this.personalizationThreshold,
      });
      return this.generators[userState.personalise.state].generate(ctx, opts);
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
            user_id: opts.user_id,
            feed_version: this.opts.feed_version,
          }),
          this.feedPreferencesConfigGenerator.generate(ctx, opts),
        ]);

        delete lofnConfig.config.page_size;
        delete lofnConfig.config.total_pages;

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
