import { RequestInit } from 'node-fetch';
import {
  ISkadiApiClient,
  type GetCampaignByIdProps,
  type GetCampaignsProps,
  type PostEstimatedReach,
  type PromotedPost,
  type PromotedPostList,
} from './types';
import { GarmrNoopService, IGarmrService, GarmrService } from '../../garmr';
import { fetchOptions as globalFetchOptions } from '../../../http';
import { fetchParse } from '../../retry';
import { ONE_DAY_IN_SECONDS } from '../../../common';

export class SkadiApiClient implements ISkadiApiClient {
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

  startPostCampaign({
    postId,
    userId,
    durationInDays,
    budget,
  }: {
    postId: string;
    userId: string;
    durationInDays: number;
    budget: number;
  }): Promise<{ campaign_id: string }> {
    return this.garmr.execute(() => {
      return fetchParse(`${this.url}/promote/post/create`, {
        ...this.fetchOptions,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: postId,
          user_id: userId,
          duration: durationInDays * ONE_DAY_IN_SECONDS,
          budget,
        }),
      });
    });
  }

  cancelPostCampaign({
    campaignId,
    userId,
  }: {
    campaignId: string;
    userId: string;
  }): Promise<{ current_budget: string }> {
    return this.garmr.execute(() => {
      return fetchParse(`${this.url}/promote/post/cancel`, {
        ...this.fetchOptions,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ campaign_id: campaignId, user_id: userId }),
      });
    });
  }

  estimatePostBoostReach({
    postId,
    userId,
    durationInDays,
    budget,
  }: {
    postId: string;
    userId: string;
    durationInDays: number;
    budget: number;
  }): Promise<PostEstimatedReach> {
    return this.garmr.execute(() => {
      return fetchParse(`${this.url}/promote/post/reach`, {
        ...this.fetchOptions,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: postId,
          user_id: userId,
          duration: durationInDays * ONE_DAY_IN_SECONDS,
          budget,
        }),
      });
    });
  }

  getCampaignById({
    campaignId,
    userId,
  }: GetCampaignByIdProps): Promise<PromotedPost> {
    return this.garmr.execute(() => {
      return fetchParse(`${this.url}/promote/post/get`, {
        ...this.fetchOptions,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ campaign_id: campaignId, user_id: userId }),
      });
    });
  }

  getCampaigns({
    limit,
    offset,
    userId,
  }: GetCampaignsProps): Promise<PromotedPostList> {
    return this.garmr.execute(() => {
      return fetchParse(`${this.url}/promote/post/list`, {
        ...this.fetchOptions,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ limit, offset, user_id: userId }),
      });
    });
  }
}

const garmBoostService = new GarmrService({
  service: SkadiApiClient.name,
  breakerOpts: {
    halfOpenAfter: 5 * 1000,
    threshold: 0.1,
    duration: 10 * 1000,
  },
  retryOpts: {
    maxAttempts: 1,
  },
});

export const skadiApiClient = new SkadiApiClient(process.env.SKADI_API_ORIGIN, {
  garmr: garmBoostService,
});
