import {
  DynamicConfig,
  FeedConfig,
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
  FeedUserStateConfigGenerator,
  SimpleFeedConfigGenerator,
} from './configs';
import { SnotraClient } from '../snotra';
import { LofnClient } from '../lofn';

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

export const snotraClient = new SnotraClient();
export const feedClient = new FeedClient();
export const lofnClient = new LofnClient();

const opts = {
  includeBlockedTags: true,
  includeAllowedTags: true,
  includeBlockedSources: true,
  includeSourceMemberships: true,
  includePostTypes: true,
};

export const baseFeedConfig: Partial<FeedConfig> = {
  source_types: ['machine', 'squad'],
  allowed_languages: ['en'],
};

export const feedGenerators: Partial<Record<FeedVersion, FeedGenerator>> =
  Object.freeze({
    '26': new FeedGenerator(
      feedClient,
      new FeedUserStateConfigGenerator(snotraClient, {
        personalised: new FeedPreferencesConfigGenerator(
          {
            ...baseFeedConfig,
            feed_config_name: FeedConfigName.VectorV26,
          },
          opts,
        ),
        non_personalised: new FeedPreferencesConfigGenerator(
          {
            ...baseFeedConfig,
            feed_config_name: FeedConfigName.PersonaliseV27,
          },
          opts,
        ),
      }),
    ),
    '29': new FeedGenerator(
      feedClient,
      new FeedUserStateConfigGenerator(snotraClient, {
        personalised: new FeedPreferencesConfigGenerator(
          {
            ...baseFeedConfig,
            feed_config_name: FeedConfigName.VectorV27,
          },
          opts,
        ),
        non_personalised: new FeedPreferencesConfigGenerator(
          {
            ...baseFeedConfig,
            feed_config_name: FeedConfigName.PersonaliseV27,
          },
          opts,
        ),
      }),
    ),
    popular: new FeedGenerator(
      new FeedClient(process.env.POPULAR_FEED),
      new FeedPreferencesConfigGenerator(
        {},
        {
          includePostTypes: true,
          includeBlockedSources: true,
          includeBlockedTags: true,
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
  if (version >= 30) {
    return new FeedGenerator(
      feedClient,
      new FeedLofnConfigGenerator({}, lofnClient, {
        ...opts,
        feed_version: version.toString() as FeedVersion,
      }),
    );
  }

  return feedGenerators[version.toString()] ?? feedGenerators['29'];
};
