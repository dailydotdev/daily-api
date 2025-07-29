import { RequestInit } from 'node-fetch';
import {
  ISkadiApiClient,
  type CancelPostCampaignResponse,
  type EstimatedBoostReachParams,
  type GetCampaignByIdProps,
  type GetCampaignListResponse,
  type GetCampaignResponse,
  type GetCampaignsProps,
  type PostEstimatedReach,
  type PromotedPost,
  type PromotedPostList,
  type StartPostCampaignResponse,
} from './types';
import { GarmrNoopService, IGarmrService, GarmrService } from '../../garmr';
import { fetchOptions as globalFetchOptions } from '../../../http';
import { fetchParse } from '../../retry';
import { ONE_DAY_IN_SECONDS } from '../../../common';

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
});

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
  }): Promise<{ campaignId: string }> {
    return this.garmr.execute(async () => {
      const response = await fetchParse<StartPostCampaignResponse>(
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
  }: {
    campaignId: string;
    userId: string;
  }): Promise<{ currentBudget: string }> {
    return this.garmr.execute(async () => {
      const response = await fetchParse<CancelPostCampaignResponse>(
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
  }) {
    return this.garmr.execute(async () => {
      const response = await fetchParse<PostEstimatedReach>(
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
      };
    });
  }

  estimatePostBoostReach({
    postId,
    userId,
  }: Pick<
    EstimatedBoostReachParams,
    'userId' | 'postId'
  >): Promise<PostEstimatedReach> {
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
  }: EstimatedBoostReachParams): Promise<PostEstimatedReach> {
    const params = {
      post_id: postId,
      user_id: userId,
      budget,
      duration: durationInDays * ONE_DAY_IN_SECONDS,
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

  getCampaigns({
    limit,
    offset,
    userId,
  }: GetCampaignsProps): Promise<GetCampaignListResponse> {
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
      };
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
