import type { Campaign, CampaignType } from '../../../../entity/campaign';
import type { CancelCampaignArgs, EstimatedReachResponse } from '../common';

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
