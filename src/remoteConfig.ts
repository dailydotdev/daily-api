import { GrowthBook } from '@growthbook/growthbook';
import { logger } from './logger';

type RemoteConfigValue = {
  vordrWords: string[];
  vordrIps: string[];
  ignoredWorkEmailDomains: string[];
};

class RemoteConfig {
  private gb?: GrowthBook;
  private readonly configKey = 'api-config';

  async init(): Promise<void> {
    this.gb = new GrowthBook({
      apiHost: 'https://cdn.growthbook.io',
      clientKey: process.env.GROWTHBOOK_CLIENT_KEY,
    });

    await this.gb.init({
      streaming: true,
    });

    logger.info('connected remote config');
  }

  get vars(): Partial<RemoteConfigValue> {
    if (!this.gb) {
      throw new Error('remote config not initialized');
    }

    const result = this.gb.getFeatureValue(this.configKey, null);

    if (!result) {
      logger.error('failed to get remote config');

      return {};
    }

    return result;
  }
}

export const remoteConfig = new RemoteConfig();
