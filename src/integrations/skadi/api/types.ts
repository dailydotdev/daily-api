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
  budget: string;
  current_budget: string;
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

export interface ISkadiApiClient {
  startPostCampaign(params: {
    postId: string;
    userId: string;
    durationInDays: number;
    budget: number;
  }): Promise<{
    campaign_id: string;
  }>;
  cancelPostCampaign(params: { campaignId: string; userId: string }): Promise<{
    current_budget: string;
  }>;
  estimatePostBoostReach(params: {
    postId: string;
    userId: string;
    durationInDays: number;
    budget: number;
  }): Promise<PostEstimatedReach>;
  getCampaignById: (params: GetCampaignByIdProps) => Promise<PromotedPost>;
  getCampaigns: (params: GetCampaignsProps) => Promise<PromotedPostList>;
}
