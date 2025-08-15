import type { User } from '../../../entity';
import type { CampaignType } from '../../../entity/campaign';

export interface PostBoostReach {
  min: number;
  max: number;
}

export interface EstimatedReach {
  impressions: number;
  clicks: number;
  users: number;
  min_impressions: number;
  max_impressions: number;
}

export type LegacyPostEstimatedReach = Pick<
  EstimatedReachResponse,
  'clicks' | 'impressions' | 'users'
>;

export interface EstimatedReachResponse
  extends Pick<EstimatedReach, 'impressions' | 'clicks' | 'users'> {
  minImpressions: number;
  maxImpressions: number;
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

export interface StartPostCampaignParams
  extends Pick<StartCampaignParams, 'userId' | 'budget' | 'durationInDays'> {
  postId: string;
}

export interface StartCampaignParams {
  value: string;
  userId: string;
  durationInDays: number;
  budget: number;
  type: CampaignType;
}

export interface CampaignDailyReach {
  type: CampaignType;
  value: string;
  budget: number;
  duration: number;
  user_id: string;
}

export interface CancelCampaignArgs {
  campaignId: string;
  userId: string;
}

export interface ISkadiApiClient {
  startCampaign(params: StartCampaignParams): Promise<{ campaignId: string }>;
  cancelCampaign(
    params: CancelCampaignArgs,
  ): Promise<{ currentBudget: string }>;
  estimateBoostReachDaily(
    params: CampaignDailyReach,
  ): Promise<EstimatedReachResponse>;
  startPostCampaign(
    params: StartPostCampaignParams,
  ): Promise<{ campaignId: string }>;
  cancelPostCampaign(
    params: CancelCampaignArgs,
  ): Promise<{ currentBudget: string }>;
  estimatePostBoostReach(
    params: Pick<EstimatedPostBoostReachParams, 'userId' | 'postId'>,
  ): Promise<LegacyPostEstimatedReach>;
  estimatePostBoostReachDaily(
    params: StartPostCampaignParams,
  ): Promise<EstimatedReachResponse>;
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
