import type { User } from '../../entity';

// Keep the type flexible to allow for future changes
export type SkadiAd = {
  title: string;
  link: string;
  image: string;
  company_name: string;
  company_logo: string;
  call_to_action: string;
};
export type SkadiResponse = Partial<{
  type: string;
  value: {
    digest: SkadiAd;
  };
  pixels: string[];
}>;

export interface PostBoostReach {
  estimatedReach: { min: number; max: number };
}

export interface PromotedPost {
  campaignId: string;
  postId: string;
  status: string;
  budget: string;
  currentBudget: string;
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

export interface ISkadiClient {
  getAd(
    placement: string,
    metadata: {
      USERID: string;
    },
  ): Promise<SkadiResponse>;
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
  }): Promise<PostBoostReach>;
  getCampaignById: (params: GetCampaignByIdProps) => Promise<PromotedPost>;
  getCampaigns: (params: GetCampaignsProps) => Promise<PromotedPostList>;
}
