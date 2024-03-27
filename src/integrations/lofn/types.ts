import { FeedConfig, FeedVersion } from '../feed';

export type UserState = 'personalised' | 'non_personalised';

export type TyrMetadata = {
  [key: string]: unknown;
};

export type LofnFeedConfigResponse = {
  user_id: string;
  config: FeedConfig;
  tyr_metadata?: TyrMetadata;
};

export type LofnFeedConfigPayload = {
  user_id: string;
  feed_version: FeedVersion;
};

export interface ILofnClient {
  fetchConfig(payload: LofnFeedConfigPayload): Promise<LofnFeedConfigResponse>;
}
