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
  campaignId: string;
  postId: string;
  status: string;
  budget: number;
  currentBudget: number;
  startedAt: Date;
  endedAt?: Date;
  impressions: number;
  clicks: number;
}

export interface PromotedPostList {
  promotedPosts: PromotedPost[];
  impressions: number;
  clicks: number;
  totalSpend: number;
  postIds: string[];
}

export interface GetCampaignByIdProps {
  campaignId: PromotedPost['campaignId'];
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
    duration: number;
    budget: number;
  }): Promise<{
    campaignId: string;
  }>;
  cancelPostCampaign(params: { postId: string; userId: string }): Promise<{
    success: boolean;
  }>;
  estimatePostBoostReach(params: {
    postId: string;
    userId: string;
    duration: number;
    budget: number;
  }): Promise<PostEstimatedReach>;
  getCampaignById: (params: GetCampaignByIdProps) => Promise<PromotedPost>;
  getCampaigns: (params: GetCampaignsProps) => Promise<PromotedPostList>;
}
