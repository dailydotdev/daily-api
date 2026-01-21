import {
  baseFeedConfig,
  DynamicConfig,
  FeedConfigGenerator,
  FeedConfigName,
  FeedResponse,
  FeedVersion,
  IFeedClient,
} from './types';
import { Context } from '../../Context';
import { FeedClient } from './clients';
import {
  FeedLofnConfigGenerator,
  FeedPreferencesConfigGenerator,
  Options,
  SimpleFeedConfigGenerator,
} from './configs';
import { LofnClient } from '../lofn';
import { GarmrService } from '../garmr';
import { FeedOrderBy } from '../../entity/Feed';

/**
 * Utility class for easily generating feeds using provided config and client
 */
export class FeedGenerator {
  private readonly client: IFeedClient;
  private readonly config: FeedConfigGenerator;
  private readonly feedId?: string;

  constructor(
    client: IFeedClient,
    config: FeedConfigGenerator,
    feedId?: string,
  ) {
    this.client = client;
    this.config = config;
    this.feedId = feedId;
  }

  async generate(ctx: Context, opts: DynamicConfig): Promise<FeedResponse> {
    const { config, extraMetadata } = await this.config.generate(ctx, opts);
    const userId = opts.user_id;
    return this.client.fetchFeed(
      ctx,
      this.feedId ?? userId!,
      config,
      extraMetadata,
    );
  }
}

const garmFeedService = new GarmrService({
  service: FeedClient.name,
  breakerOpts: {
    halfOpenAfter: 5 * 1000,
    threshold: 0.1,
    duration: 10 * 1000,
  },
});

const garmLofnService = new GarmrService({
  service: LofnClient.name,
  breakerOpts: {
    halfOpenAfter: 5 * 1000,
    threshold: 0.1,
    duration: 10 * 1000,
  },
});

export const feedClient = new FeedClient(process.env.INTERNAL_FEED, {
  garmr: garmFeedService,
});
export const lofnClient = new LofnClient(process.env.LOFN_ORIGIN, {
  garmr: garmLofnService,
});

const opts: Options = {
  includeBlockedTags: true,
  includeAllowedTags: true,
  includeBlockedSources: true,
  includeSourceMemberships: true,
  includePostTypes: true,
  includeContentCuration: true,
  includeBlockedWords: true,
  includeFollowedSources: true,
  includeFollowedUsers: true,
  includeBlockedUsers: true,
};

export const feedGenerators: Partial<Record<FeedVersion, FeedGenerator>> =
  Object.freeze({
    popular: new FeedGenerator(
      feedClient,
      new FeedPreferencesConfigGenerator(
        {
          ...baseFeedConfig,
          feed_config_name: FeedConfigName.Popular,
          min_day_range: 14,
          allowed_content_curations: [
            'news',
            'release',
            'opinion',
            'comparison',
            'story',
          ],
        },
        {
          includePostTypes: true,
          includeBlockedSources: true,
          includeBlockedTags: true,
          includeContentCuration: true,
          includeBlockedWords: true,
          includeBlockedUsers: true,
        },
      ),
      'popular',
    ),
    time: new FeedGenerator(
      feedClient,
      new FeedPreferencesConfigGenerator(
        {
          ...baseFeedConfig,
          feed_config_name: FeedConfigName.Popular,
          min_day_range: 14,
          allowed_content_curations: [
            'news',
            'release',
            'opinion',
            'comparison',
            'story',
          ],
          order_by: FeedOrderBy.Date,
        },
        {
          includePostTypes: true,
          includeBlockedSources: true,
          includeBlockedTags: true,
          includeContentCuration: true,
          includeBlockedWords: true,
          includeBlockedUsers: true,
        },
      ),
      'time',
    ),
    onboarding: new FeedGenerator(
      feedClient,
      new FeedPreferencesConfigGenerator(
        {
          feed_config_name: FeedConfigName.Onboarding,
          total_pages: 1,
        },
        opts,
      ),
      'onboarding',
    ),
    post_similarity: new FeedGenerator(
      feedClient,
      new SimpleFeedConfigGenerator({
        feed_config_name: FeedConfigName.PostSimilarity,
        total_pages: 1,
      }),
    ),
  });

export const versionToFeedGenerator = (version: number): FeedGenerator => {
  return new FeedGenerator(
    feedClient,
    new FeedLofnConfigGenerator(baseFeedConfig, lofnClient, {
      ...opts,
      feed_version: version.toString() as FeedVersion,
    }),
  );
};

export const versionToTimeFeedGenerator = (version: number): FeedGenerator => {
  return new FeedGenerator(
    feedClient,
    new FeedLofnConfigGenerator(
      { ...baseFeedConfig, order_by: FeedOrderBy.Date },
      lofnClient,
      {
        ...opts,
        feed_version: version.toString() as FeedVersion,
      },
    ),
  );
};
