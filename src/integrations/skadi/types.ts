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
  estimatePostBoostReach(params: {
    postId: string;
    userId: string;
    duration: number;
    budget: number;
  }): Promise<PostBoostReach>;
}
