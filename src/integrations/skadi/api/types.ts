import type { User } from '../../../entity';

export interface PostBoostReach {
  min: number;
  max: number;
}

export interface PostEstimatedReach {
  impressions: number;
  clicks: number;
  users: number;
}

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
}

export interface PromotedPostList {
  promoted_posts: PromotedPost[];
  impressions: number;
  clicks: number;
  total_spend: string;
  post_ids: string[];
}

export interface GetCampaignByIdProps {
  campaignId: PromotedPost['campaign_id'];
  userId: User['id'];
}

export interface GetCampaignsProps {
  userId: User['id'];
  offset: number;
  limit: number;
}

export interface StartPostCampaignResponse {
  campaign_id: string;
}

export interface CancelPostCampaignResponse {
  current_budget: string;
}

export interface GetCampaignResponse
  extends Pick<
    PromotedPost,
    'budget' | 'clicks' | 'impressions' | 'spend' | 'status'
  > {
  startedAt: number;
  endedAt: number;
  campaignId: string;
  postId: string;
}

export interface GetCampaignListResponse
  extends Pick<PromotedPostList, 'clicks' | 'impressions'> {
  promotedPosts: GetCampaignResponse[];
  postIds: string[];
  totalSpend: string; // float
}

export type EstimatedBoostReachParams = {
  postId: string;
  userId: string;
  durationInDays?: number;
  budget?: number;
};

export interface ISkadiApiClient {
  startPostCampaign(params: {
    postId: string;
    userId: string;
    durationInDays: number;
    budget: number;
  }): Promise<{ campaignId: string }>;
  cancelPostCampaign(params: {
    campaignId: string;
    userId: string;
  }): Promise<{ currentBudget: string }>;
  estimatePostBoostReach(
    params: EstimatedBoostReachParams,
  ): Promise<PostEstimatedReach>;
  getCampaignById: (
    params: GetCampaignByIdProps,
  ) => Promise<GetCampaignResponse>;
  getCampaigns: (params: GetCampaignsProps) => Promise<GetCampaignListResponse>;
}

export enum CampaignUpdateAction {
  Completed = 'completed',
  FirstMilestone = 'first_milestone',
  Started = 'started',
}
