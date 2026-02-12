import { fetch, type RequestInit } from 'undici';
import {
  type EstimatedDailyReachParams,
  TargetingType,
  type ISkadiApiClientV2,
  type CancelPostCampaignResponse,
} from './types';
import { GarmrNoopService, IGarmrService, GarmrService } from '../../../garmr';
import { fetchOptions as globalFetchOptions } from '../../../../http';
import { fetchParse } from '../../../retry';
import { CampaignType, type Campaign } from '../../../../entity';
import { v5 } from 'uuid';
import { coresToUsd } from '../../../../common/number';
import type {
  CancelCampaignArgs,
  EstimatedReachResponse,
  EstimatedReach,
} from '../common';
import { randomUUID } from 'node:crypto';

const skadiNamespace = '67fb92c7-8105-43a9-802a-07aac76493cc';

export const getAdvertiserId = (userId: string) => v5(userId, skadiNamespace);

const generateTargeting = (
  type: CampaignType,
  referenceId: string,
  keywords: string[],
) => {
  const isNone = type === CampaignType.Squad && keywords.length === 0;

  return {
    type: isNone ? TargetingType.None : TargetingType.Boost,
    value: {
      boost: {
        post_id: type === CampaignType.Post ? referenceId : undefined,
        keywords: type === CampaignType.Post ? undefined : keywords,
      },
    },
  };
};

const generateCreativeValue = (type: CampaignType, referenceId: string) => {
  switch (type) {
    case CampaignType.Post:
      return { post: { id: referenceId } };
    case CampaignType.Squad:
      return { squad: { id: referenceId } };
    default:
      throw new Error(`Unable to process campaign type: ${type}`);
  }
};

export class SkadiApiClientV2 implements ISkadiApiClientV2 {
  private readonly fetchOptions: RequestInit;
  private readonly garmr: IGarmrService;

  constructor(
    private readonly url: string,
    options?: {
      fetchOptions?: RequestInit;
      garmr?: IGarmrService;
    },
  ) {
    const {
      fetchOptions = globalFetchOptions,
      garmr = new GarmrNoopService(),
    } = options || {};

    this.fetchOptions = fetchOptions;
    this.garmr = garmr;
  }

  startCampaign(campaign: Campaign, keywords: string[] = []) {
    const { userId, type, id, createdAt, endedAt, flags, referenceId } =
      campaign;
    const advertiser_id = getAdvertiserId(userId);
    const targeting = generateTargeting(type, referenceId, keywords);

    return this.garmr.execute(async () => {
      const response = await fetch(`${this.url}/api/campaign/create`, {
        ...this.fetchOptions,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          advertiser_id,
          campaign_id: id,
          budget: coresToUsd(flags.budget!),
          start_time: createdAt.getTime(),
          end_time: endedAt.getTime(),
          creatives: [
            {
              id: randomUUID(), // we just create it on API side but we don't store it per Viktor request
              type,
              value: generateCreativeValue(type, referenceId),
            },
          ],
          targeting,
        }),
      });

      const text = await response.text();

      if (!response.ok) {
        throw new Error(text || 'An error occured starting the campaign');
      }

      if (!text) {
        return; // Skadi returns nothing when successful
      }

      const { error } = JSON.parse(text);

      if (error) {
        throw new Error(error);
      }
    });
  }

  cancelCampaign({
    campaignId,
    userId,
  }: CancelCampaignArgs): Promise<{ budget: string }> {
    return this.garmr.execute(async () => {
      const response = await fetch(`${this.url}/api/campaign/cancel`, {
        ...this.fetchOptions,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaign_id: campaignId,
          advertiser_id: getAdvertiserId(userId),
        }),
      });

      const text = await response.text();

      if (!response.ok) {
        throw new Error(text || 'An error occured starting the campaign');
      }

      const { error, budget } = JSON.parse(text) as CancelPostCampaignResponse;

      if (error) {
        throw new Error(error);
      }

      return { budget };
    });
  }

  estimateBoostReachDaily({
    budget,
    value,
    type,
    keywords = [],
  }: EstimatedDailyReachParams): Promise<EstimatedReachResponse> {
    const targeting = generateTargeting(type, value, keywords);

    return this.garmr.execute(async () => {
      const { reach, error } = await fetchParse<{
        reach: EstimatedReach;
        error?: string;
      }>(`${this.url}/api/reach`, {
        ...this.fetchOptions,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          daily_budget: budget,
          targeting,
        }),
      });

      if (error) {
        throw new Error(error);
      }

      return {
        impressions: reach.impressions ?? 0,
        clicks: reach.clicks ?? 0,
        users: reach.users ?? 0,
        minImpressions: reach.min_impressions ?? 0,
        maxImpressions: reach.max_impressions ?? 0,
      };
    });
  }
}

const garmBoostService = new GarmrService({
  service: SkadiApiClientV2.name,
  breakerOpts: {
    halfOpenAfter: 5 * 1000,
    threshold: 0.1,
    duration: 10 * 1000,
  },
  retryOpts: {
    maxAttempts: 1,
  },
});

export const skadiApiClientV2 = new SkadiApiClientV2(
  process.env.SKADI_API_ORIGIN_V2,
  { garmr: garmBoostService },
);
