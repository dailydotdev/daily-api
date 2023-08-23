import {
  FeedConfigGenerator,
  FeedConfigName,
  FeedResponse,
  IFeedClient,
} from './types';
import { Context } from '../../Context';
import { CachedFeedClient, FeedClient } from './clients';
import { ioRedisPool } from '../../redis';
import {
  FeedPreferencesConfigGenerator,
  SimpleFeedConfigGenerator,
} from './configs';

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

const client = new FeedClient();
export const cachedFeedClient = new CachedFeedClient(client, ioRedisPool);
const opts = {
  includeBlockedTags: true,
  includeAllowedTags: true,
  includeBlockedSources: true,
  includeSourceMemberships: true,
};

export const feedGenerators: Record<string, FeedGenerator> = Object.freeze({
  '11': new FeedGenerator(
    cachedFeedClient,
    new FeedPreferencesConfigGenerator(
      { feed_config_name: FeedConfigName.Personalise },
      opts,
    ),
  ),
  '14': new FeedGenerator(
    cachedFeedClient,
    new FeedPreferencesConfigGenerator(
      { feed_config_name: FeedConfigName.Vector },
      opts,
    ),
  ),
  popular: new FeedGenerator(
    cachedFeedClient,
    new SimpleFeedConfigGenerator({
      feed_config_name: FeedConfigName.Personalise,
    }),
    'popular',
  ),
});

export const versionToFeedGenerator = (version: number): FeedGenerator => {
  return feedGenerators[version.toString()] ?? feedGenerators['11'];
};
