import { GrowthBook } from '@growthbook/growthbook';
import { logger } from './logger';
import { isProd } from './common/utils';
import type { CoresRole } from './types';
import type { PurchaseType } from './common/plus';

type RemoteConfigValue = {
  inc: number;
  vordrWords: string[];
  vordrIps: string[];
  blockedCountries: string[];
  ignoredWorkEmailDomains: string[];
  origins: string[];
  clickbaitTitleProbabilityThreshold: number;
  plusCustomFeed: boolean;
  rateLimitReputationThreshold: number;
  postRateLimit: number;
  commentRateLimit: number;
  fees: Partial<{
    transfer: number;
  }>;
  approvedStoreKitSandboxUsers: string[];
  coresRoleRules: {
    regions: string[];
    role: CoresRole;
  }[];
  kvasirRequirePlus: boolean;
  paddleIps: string[];
  paddleTestDiscountIds: string[];
  paddleProductIds: Partial<Record<PurchaseType, string>>;
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

  get validLanguages(): Record<string, string> {
    if (!process.env.GROWTHBOOK_API_CONFIG_CLIENT_KEY) {
      return {
        de: 'German',
        en: 'English',
        es: 'Spanish',
        no: 'Norwegian',
        fr: 'French',
      };
    }

    if (!this.gb) {
      throw new Error('remote config not initialized');
    }

    const result = this.gb.getFeatureValue(
      process.env.VALID_LANGUAGES_FEATURE_KEY,
      null,
    );

    if (!result) {
      logger.error('failed to get valid languages');

      return {};
    }

    return result;
  }
}

export const remoteConfig = new RemoteConfig();
