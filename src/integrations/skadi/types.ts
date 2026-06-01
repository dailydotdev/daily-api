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
};

export interface ISkadiClient<TValue> {
  getAd(
    placement: string,
    metadata: {
      USERID: string;
    },
  ): Promise<SkadiResponse<TValue>>;
}
