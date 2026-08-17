export type EncoreOfferBadgeLabel = 'free_trial' | 'discount';

export type EncoreOffer = {
  impressionUid: string;
  clickUrl: string;
  title: string;
  description: string | null;
  imageUrl: string;
  additionalImages: string[];
  advertiserName: string;
  advertiserLogo: string | null;
  perk?: string | null;
  badgeLabel: EncoreOfferBadgeLabel | null;
};

export type EncoreOffersFeedRequest = {
  userId: string;
  limit?: number;
  attributes: {
    countryCode: string;
    language: string;
    platform?: 'android' | 'ios' | 'web';
  };
};

export type EncoreOffersFeedResponse = {
  success: boolean;
  offers: EncoreOffer[];
};

export type IEncoreClient = {
  getOffersFeed(
    request: EncoreOffersFeedRequest,
  ): Promise<EncoreOffersFeedResponse>;
  confirmDelivered(
    impressionUid: string,
    deliveredTimestamp: number,
  ): Promise<void>;
};
