import { RequestInit } from 'node-fetch';
import {
  type EstimatedDailyReachParams,
  TargetingType,
  type CancelPostCampaignResponse,
  type ISkadiApiClientV2,
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

const skadiNamespace = '67fb92c7-8105-43a9-802a-07aac76493cc';

export const getAdvertiserId = (userId: string) => v5(userId, skadiNamespace);

const generateTargeting = (
  type: CampaignType,
  referenceId: string,
  keywords: string[],
) => {
  const isNone = type === CampaignType.Source && keywords.length === 0;

  return {
    type: isNone ? TargetingType.None : TargetingType.Boost,
    value: {
      boost: {
        post_id: type === CampaignType.Post ? referenceId : undefined,
        keywords,
      },
    },
  };
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
    const {
      userId,
      type,
      id,
      creativeId,
      createdAt,
      endedAt,
      flags,
      referenceId,
    } = campaign;
    const advertiser_id = getAdvertiserId(userId);
    const targeting = generateTargeting(type, referenceId, keywords);

    return this.garmr.execute(async () => {
      const response = await fetchParse<{ error?: string }>(
        `${this.url}/campaign/create`,
        {
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
            creatives: [{ id: creativeId, type, value: referenceId }],
            targeting,
          }),
        },
      );

      if (response.error) {
        throw new Error(response.error);
      }
    });
  }

  cancelCampaign({
    campaignId,
    userId,
  }: CancelCampaignArgs): Promise<{ budget: string }> {
    return this.garmr.execute(async () => {
      const response = await fetchParse<CancelPostCampaignResponse>(
        `${this.url}/campaign/cancel`,
        {
          ...this.fetchOptions,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            campaign_id: campaignId,
            advertiser_id: getAdvertiserId(userId),
          }),
        },
      );

      if (response.error) {
        throw new Error(response.error);
      }

      return { budget: response.budget };
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
      const response = await fetchParse<EstimatedReach>(
        `${this.url}/campaign/reach`,
        {
          ...this.fetchOptions,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            budget,
            targeting,
          }),
        },
      );

      return {
        impressions: response.impressions ?? 0,
        clicks: response.clicks ?? 0,
        users: response.users ?? 0,
        minImpressions: response.min_impressions ?? 0,
        maxImpressions: response.max_impressions ?? 0,
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
