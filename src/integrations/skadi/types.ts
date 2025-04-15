// Keep the type flexible to allow for future changes
export type SkadiAd = {
  title: string;
  link: string;
  image: string;
  company_name: string;
  company_logo: string;
  call_to_action: string;
};
export type SkadiResponse = {
  type: string;
  value: {
    digest: SkadiAd;
  };
  pixels: string[];
};

export interface ISkadiClient {
  getAd(
    placement: string,
    metadata: {
      USERID: string;
    },
  ): Promise<SkadiResponse>;
}
