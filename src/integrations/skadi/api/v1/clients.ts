import { RequestInit } from 'node-fetch';
import {
  ISkadiApiClientV1,
  type EstimatedPostBoostReachParams,
  type GetCampaignByIdProps,
  type GetCampaignResponse,
  type GetCampaignsProps,
  type PromotedPost,
  type PromotedPostList,
  type StartPostCampaignParams,
} from './types';
import { GarmrNoopService, IGarmrService, GarmrService } from '../../../garmr';
import { fetchOptions as globalFetchOptions } from '../../../../http';
import { fetchParse } from '../../../retry';
import { ONE_DAY_IN_SECONDS } from '../../../../common';
import type {
  CancelCampaignArgs,
  EstimatedReachResponse,
  EstimatedReach,
} from '../common';

const mapCampaign = (campaign: PromotedPost): GetCampaignResponse => ({
  campaignId: campaign.campaign_id,
  postId: campaign.post_id,
  status: campaign.status,
  spend: campaign.spend,
  budget: campaign.budget,
  startedAt: campaign.started_at,
  endedAt: campaign.ended_at,
  impressions: campaign.impressions,
  clicks: campaign.clicks,
  users: campaign.users,
});

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

  startPostCampaign({
    postId,
    userId,
    durationInDays,
    budget,
  }: StartPostCampaignParams): Promise<{ campaignId: string }> {
    return this.garmr.execute(async () => {
      const response = await fetchParse<{ campaign_id: string }>(
        `${this.url}/promote/post/create`,
        {
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
        },
      );

      return { campaignId: response.campaign_id };
    });
  }

  cancelPostCampaign({
    campaignId,
    userId,
  }: CancelCampaignArgs): Promise<{ currentBudget: string }> {
    return this.garmr.execute(async () => {
      const response = await fetchParse<{ current_budget: string }>(
        `${this.url}/promote/post/cancel`,
        {
          ...this.fetchOptions,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ campaign_id: campaignId, user_id: userId }),
        },
      );

      return { currentBudget: response.current_budget };
    });
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

  getCampaignById({
    campaignId,
    userId,
  }: GetCampaignByIdProps): Promise<GetCampaignResponse> {
    return this.garmr.execute(async () => {
      const response = await fetchParse<{ promoted_post: PromotedPost }>(
        `${this.url}/promote/post/get`,
        {
          ...this.fetchOptions,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ campaign_id: campaignId, user_id: userId }),
        },
      );

      return mapCampaign(response.promoted_post);
    });
  }

  getCampaigns({ limit, offset, userId }: GetCampaignsProps) {
    return this.garmr.execute(async () => {
      const response = await fetchParse<PromotedPostList>(
        `${this.url}/promote/post/list`,
        {
          ...this.fetchOptions,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ limit, offset, user_id: userId }),
        },
      );

      return {
        promotedPosts: response.promoted_posts?.map(mapCampaign) ?? [],
        postIds: response.post_ids ?? [],
        totalSpend: response.total_spend,
        impressions: response.impressions,
        clicks: response.clicks,
        users: response.users,
      };
    });
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
