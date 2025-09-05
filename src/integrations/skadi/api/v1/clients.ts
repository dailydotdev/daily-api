import { RequestInit } from 'node-fetch';
import {
  ISkadiApiClientV1,
  type EstimatedPostBoostReachParams,
  type StartPostCampaignParams,
} from './types';
import { GarmrNoopService, IGarmrService, GarmrService } from '../../../garmr';
import { fetchOptions as globalFetchOptions } from '../../../../http';
import { fetchParse } from '../../../retry';
import { ONE_DAY_IN_SECONDS } from '../../../../common';
import type { EstimatedReachResponse, EstimatedReach } from '../common';

export class SkadiApiClientV1 implements ISkadiApiClientV1 {
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

  private fetchBoostReach(params: {
    post_id: string;
    user_id: string;
    budget?: number;
    duration?: number;
  }): Promise<EstimatedReachResponse> {
    return this.garmr.execute(async () => {
      const response = await fetchParse<EstimatedReach>(
        `${this.url}/promote/post/reach`,
        {
          ...this.fetchOptions,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params),
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

  estimatePostBoostReach({
    postId,
    userId,
  }: Pick<EstimatedPostBoostReachParams, 'userId' | 'postId'>) {
    const params = {
      post_id: postId,
      user_id: userId,
    };

    return this.fetchBoostReach(params);
  }

  estimatePostBoostReachDaily({
    postId,
    userId,
    durationInDays,
    budget,
  }: StartPostCampaignParams) {
    const params = {
      post_id: postId,
      user_id: userId,
      duration: durationInDays * ONE_DAY_IN_SECONDS,
      budget,
    };

    return this.fetchBoostReach(params);
  }
}

const garmBoostService = new GarmrService({
  service: SkadiApiClientV1.name,
  breakerOpts: {
    halfOpenAfter: 5 * 1000,
    threshold: 0.1,
    duration: 10 * 1000,
  },
  retryOpts: {
    maxAttempts: 1,
  },
});

export const skadiApiClientV1 = new SkadiApiClientV1(
  process.env.SKADI_API_ORIGIN,
  { garmr: garmBoostService },
);
