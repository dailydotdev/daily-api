export interface CancelCampaignArgs {
  campaignId: string;
  userId: string;
}

export interface EstimatedReach {
  impressions: number;
  clicks: number;
  users: number;
  min_impressions: number;
  max_impressions: number;
}

export interface EstimatedReachResponse
  extends Pick<EstimatedReach, 'impressions' | 'clicks' | 'users'> {
  minImpressions: number;
  maxImpressions: number;
}
