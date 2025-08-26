import type { Campaign, CampaignType } from '../../../../entity/campaign';

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

export enum TargetingType {
  Boost = 'BOOST',
  None = 'NONE',
}

export interface EstimatedDailyReachParams {
  budget: number;
  value: string;
  type: CampaignType;
  keywords?: string[];
}

export interface CancelCampaignArgs {
  campaignId: string;
  userId: string;
}

export interface CancelPostCampaignResponse {
  budget: string;
  error?: string;
}

export interface ISkadiApiClientV2 {
  startCampaign(campaign: Campaign): Promise<void>;
  cancelCampaign(
    params: CancelCampaignArgs,
  ): Promise<CancelPostCampaignResponse>;
  estimateBoostReachDaily(
    params: EstimatedDailyReachParams,
  ): Promise<EstimatedReachResponse>;
}

export enum CampaignUpdateActionV2 {
  Completed = 'completed',
  FirstMilestone = 'first_milestone',
  Started = 'started',
}
