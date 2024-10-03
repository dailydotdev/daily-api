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
  SimpleFeedConfigGenerator,
} from './configs';
import { SnotraClient } from '../snotra';
import { LofnClient } from '../lofn';
import { GarmrService } from '../garmr';

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
      this.feedId ?? userId,
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

export const snotraClient = new SnotraClient();
export const feedClient = new FeedClient(process.env.INTERNAL_FEED, {
  garmr: garmFeedService,
});
export const lofnClient = new LofnClient(process.env.LOFN_ORIGIN, {
  garmr: garmLofnService,
});
export const popularFeedClient = new FeedClient(process.env.POPULAR_FEED, {
  garmr: garmFeedService,
});

const opts = {
  includeBlockedTags: true,
  includeAllowedTags: true,
  includeBlockedSources: true,
  includeSourceMemberships: true,
  includePostTypes: true,
  includeContentCuration: true,
};

export const feedGenerators: Partial<Record<FeedVersion, FeedGenerator>> =
  Object.freeze({
    popular: new FeedGenerator(
      popularFeedClient,
      new FeedPreferencesConfigGenerator(
        {},
        {
          includePostTypes: true,
          includeBlockedSources: true,
          includeBlockedTags: true,
          includeContentCuration: true,
        },
      ),
      'popular',
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
