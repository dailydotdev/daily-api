import { RequestInit } from 'node-fetch';
import {
  ISkadiApiClient,
  type CancelPostCampaignResponse,
  type GetCampaignByIdProps,
  type GetCampaignListResponseMapped,
  type GetCampaignsProps,
  type PostEstimatedReach,
  type PromotedPost,
  type PromotedPostList,
  type StartPostCampaignResponse,
} from './types';
import { GarmrNoopService, IGarmrService, GarmrService } from '../../garmr';
import { fetchOptions as globalFetchOptions } from '../../../http';
import { fetchParse } from '../../retry';
import {
  ONE_DAY_IN_SECONDS,
  type ObjectSnakeToCamelCase,
} from '../../../common';

const mapCampaign = (
  campaign: PromotedPost,
): ObjectSnakeToCamelCase<PromotedPost> => ({
  campaignId: campaign.campaign_id,
  postId: campaign.post_id,
  status: campaign.status,
  budget: campaign.budget,
  currentBudget: campaign.current_budget,
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
  }): Promise<ObjectSnakeToCamelCase<StartPostCampaignResponse>> {
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
  }): Promise<ObjectSnakeToCamelCase<CancelPostCampaignResponse>> {
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
  }): Promise<ObjectSnakeToCamelCase<PostEstimatedReach>> {
    return this.garmr.execute(async () => {
      const response = await fetchParse<PostEstimatedReach>(
        `${this.url}/promote/post/reach`,
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

      return {
        impressions: response.impressions,
        clicks: response.clicks,
        users: response.users,
      };
    });
  }

  getCampaignById({
    campaignId,
    userId,
  }: GetCampaignByIdProps): Promise<ObjectSnakeToCamelCase<PromotedPost>> {
    return this.garmr.execute(async () => {
      const response = await fetchParse<PromotedPost>(
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

      return mapCampaign(response);
    });
  }

  getCampaigns({
    limit,
    offset,
    userId,
  }: GetCampaignsProps): Promise<GetCampaignListResponseMapped> {
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
