import type { EstimatedReachResponse } from '../common';

export type LegacyPostEstimatedReach = Pick<
  EstimatedReachResponse,
  'clicks' | 'impressions' | 'users'
>;

export interface PromotedPost {
  campaign_id: string;
  post_id: string;
  status: string;
  spend: string;
  budget: string;
  started_at: number;
  ended_at: number;
  impressions: number;
  clicks: number;
  users: number;
}

export interface PromotedPostList {
  promoted_posts: PromotedPost[];
  impressions: number;
  clicks: number;
  users: number;
  total_spend: string;
  post_ids: string[];
}

export interface GetCampaignResponse
  extends Pick<
    PromotedPost,
    'budget' | 'clicks' | 'impressions' | 'spend' | 'status' | 'users'
  > {
  startedAt: number;
  endedAt: number;
  campaignId: string;
  postId: string;
}

export interface GetCampaignListResponse
  extends Pick<PromotedPostList, 'clicks' | 'impressions' | 'users'> {
  promotedPosts: GetCampaignResponse[];
  postIds: string[];
  totalSpend: string; // float
}

export type EstimatedPostBoostReachParams = StartPostCampaignParams;

export interface StartPostCampaignParams {
  postId: string;
  userId: string;
  budget: number;
  durationInDays: number;
}

export interface ISkadiApiClientV1 {
  estimatePostBoostReach(
    params: Pick<EstimatedPostBoostReachParams, 'userId' | 'postId'>,
  ): Promise<LegacyPostEstimatedReach>;
  estimatePostBoostReachDaily(
    params: StartPostCampaignParams,
  ): Promise<EstimatedReachResponse>;
}

export enum CampaignUpdateAction {
  Completed = 'completed',
  FirstMilestone = 'first_milestone',
  Started = 'started',
}
