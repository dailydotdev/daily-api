import { GrowthBook } from '@growthbook/growthbook';
import { logger } from './logger';
import { isProd } from './common/utils';
import type { SubscriptionCycles } from './paddle';

type RemoteConfigValue = {
  inc: number;
  vordrWords: string[];
  vordrIps: string[];
  ignoredWorkEmailDomains: string[];
  pricingIds: Record<string, SubscriptionCycles>;
};

class RemoteConfig {
  private gb?: GrowthBook;

  async init(): Promise<void> {
    if (!process.env.GROWTHBOOK_API_CONFIG_CLIENT_KEY) {
      if (isProd) {
        logger.warn('remote config client key missing');
      }

      return;
    }

    this.gb = new GrowthBook({
      apiHost: 'https://cdn.growthbook.io',
      clientKey: process.env.GROWTHBOOK_API_CONFIG_CLIENT_KEY,
    });

    await this.gb.init({
      streaming: true,
    });

    logger.info('connected remote config');
  }

  get vars(): Partial<RemoteConfigValue> {
    if (!process.env.GROWTHBOOK_API_CONFIG_CLIENT_KEY) {
      return {};
    }

    if (!this.gb) {
      throw new Error('remote config not initialized');
    }

    const result = this.gb.getFeatureValue(
      process.env.API_CONFIG_FEATURE_KEY,
      null,
    );

    if (!result) {
      logger.error('failed to get remote config');

      return {};
    }

    return result;
  }
}

export const remoteConfig = new RemoteConfig();

export const planTypes = remoteConfig.vars.pricingIds || {};
