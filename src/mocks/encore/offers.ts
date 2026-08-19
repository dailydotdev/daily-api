import type { EncoreOffersFeedResponse } from '../../integrations/encore/types';

export const mockEncoreOffersFeedResponse: EncoreOffersFeedResponse = {
  success: true,
  offers: [
    {
      impressionUid: '10000000-0000-4000-8000-000000000001',
      clickUrl: 'https://link.encorekit.com/mock-music',
      title: '3 Months of Music, Free',
      description: 'Celebrate your streak with a free trial',
      imageUrl:
        'https://media.daily.dev/image/upload/s--puujtBmc--/f_auto/v1755512510/public/Ads%20fallback',
      additionalImages: [],
      advertiserName: 'Acme Music',
      advertiserLogo: 'https://cdn.simpleicons.org/spotify/1DB954',
      perk: '3 months free',
      badgeLabel: 'free_trial',
    },
    {
      impressionUid: '10000000-0000-4000-8000-000000000002',
      clickUrl: 'https://link.encorekit.com/mock-notes',
      title: 'Get 50% off Notes Pro',
      description: 'Limited time offer for streak keepers',
      imageUrl:
        'https://media.daily.dev/image/upload/s--puujtBmc--/f_auto/v1755512510/public/Ads%20fallback',
      additionalImages: [],
      advertiserName: 'Acme Notes',
      advertiserLogo: 'https://cdn.simpleicons.org/notion/000000',
      perk: '50% off for 6 months',
      badgeLabel: 'discount',
    },
    {
      impressionUid: '10000000-0000-4000-8000-000000000003',
      clickUrl: 'https://link.encorekit.com/mock-vpn',
      title: '30 days of SecureVPN on us',
      description: null,
      imageUrl:
        'https://media.daily.dev/image/upload/s--puujtBmc--/f_auto/v1755512510/public/Ads%20fallback',
      additionalImages: [],
      advertiserName: 'SecureVPN',
      advertiserLogo: null,
      perk: '30 days free',
      badgeLabel: 'free_trial',
    },
  ],
};
