// Keep the type flexible to allow for future changes
export type SkadiAd = {
  title: string;
  link: string;
  image: string;
  company_name: string;
  company_logo: string;
  call_to_action: string;
};
export type SkadiResponse<TValue> = Partial<{
  type: string;
  value: TValue;
  pixels: string[];
  generation_id: string;
}>;

export type ThemedValue = {
  dark: string;
  light: string;
};

export type EngagementCreative = {
  gen_id: string;
  promoted_name: string;
  promoted_body: string;
  promoted_cta: string;
  promoted_url: string;
  promoted_logo_img: ThemedValue;
  promoted_icon_img: ThemedValue;
  promoted_gradient_start: ThemedValue;
  promoted_gradient_end: ThemedValue;
  tools: string[];
  keywords: string[];
  tags: string[];
  // Prominent placements a campaign opted into (e.g. 'top_banner',
  // 'feed_strip'). Optional: existing creatives won't carry it.
  placements?: string[];
  // CPA campaign source id. When present, boot caches a source->user mapping
  // in redis so feed queries can forward it as `cpa_source` for attribution.
  source_id?: string;
};

export interface ISkadiClient<TValue> {
  getAd(
    placement: string,
    metadata: {
      USERID: string;
    },
    options?: {
      // Campaign id forwarded as a `cid` query param (e.g. from the user's
      // referralOrigin) so skadi can target a specific campaign.
      cid?: string;
    },
  ): Promise<SkadiResponse<TValue>>;
}
