import { DeepPartial } from 'typeorm';
import { MarketingCta, MarketingCtaStatus } from '../../src/entity';

export const marketingCtaFixture: DeepPartial<MarketingCta>[] = [
  {
    campaignId: 'worlds-best-campaign',
    variant: 'card',
    status: MarketingCtaStatus.Active,
    createdAt: new Date('2024-05-13 12:00:00'),
    flags: {
      title: 'Join the best community in the world',
      description: 'Join the best community in the world',
      ctaUrl: 'http://localhost:5002',
      ctaText: 'Join now',
    },
  },
  {
    campaignId: 'worlds-second-best-campaign',
    variant: 'card',
    status: MarketingCtaStatus.Active,
    createdAt: new Date('2024-05-14 12:00:00'),
    flags: {
      title: 'Join the second best community in the world',
      description: 'Join the second best community in the world',
      ctaUrl: 'http://localhost:5002',
      ctaText: 'Join now',
    },
  },
];
