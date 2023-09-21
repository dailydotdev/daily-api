import {
  FeedConfigGenerator,
  FeedConfigName,
  FeedResponse,
  FeedVersion,
  IFeedClient,
} from './types';
import { Context } from '../../Context';
import { CachedFeedClient, FeedClient } from './clients';
import { ioRedisPool } from '../../redis';
import {
  FeedPreferencesConfigGenerator,
  FeedUserStateConfigGenerator,
  SimpleFeedConfigGenerator,
} from './configs';
import { SnotraClient, UserState } from '../snotra';

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

  async generate(
    ctx: Context,
    userId: string | undefined,
    pageSize: number,
    offset: number,
  ): Promise<FeedResponse> {
    const config = await this.config.generate(ctx, userId, pageSize, offset);
    return this.client.fetchFeed(ctx, this.feedId ?? userId, config);
  }
}

export const snotraClient = new SnotraClient();
export const feedClient = new FeedClient();
export const cachedFeedClient = new CachedFeedClient(feedClient, ioRedisPool);

const opts = {
  includeBlockedTags: true,
  includeAllowedTags: true,
  includeBlockedSources: true,
  includeSourceMemberships: true,
};

const userStateConfigs: Record<UserState, FeedConfigGenerator> = {
  personalised: new FeedPreferencesConfigGenerator(
    { feed_config_name: FeedConfigName.Vector },
    opts,
  ),
  non_personalised: new FeedPreferencesConfigGenerator(
    { feed_config_name: FeedConfigName.Personalise },
    opts,
  ),
};

export const feedGenerators: Record<FeedVersion, FeedGenerator> = Object.freeze(
  {
    '11': new FeedGenerator(
      cachedFeedClient,
      userStateConfigs.non_personalised,
    ),
    '14': new FeedGenerator(cachedFeedClient, userStateConfigs.personalised),
    '15': new FeedGenerator(
      cachedFeedClient,
      new FeedUserStateConfigGenerator(snotraClient, userStateConfigs),
    ),
    popular: new FeedGenerator(
      cachedFeedClient,
      new SimpleFeedConfigGenerator({
        providers: {
          fresh: {
            enable: true,
            remove_engaged_posts: true,
            page_size_fraction: 0.1,
          },
          engaged: {
            enable: true,
            remove_engaged_posts: true,
            page_size_fraction: 1,
            fallback_provider: 'fresh',
          },
        },
      }),
      'popular',
    ),
  },
);

export const versionToFeedGenerator = (version: number): FeedGenerator => {
  return feedGenerators[version.toString()] ?? feedGenerators['11'];
};
