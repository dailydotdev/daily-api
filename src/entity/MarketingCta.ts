import { Column, Entity, PrimaryColumn } from 'typeorm';

export type MarketingCtaVariant = 'card' | 'popover' | 'popover_small';

export type MarketingCtaFlags = {
  title: string;
  description?: string;
  image?: string;
  tagText?: string;
  tagColor?: string;
  ctaUrl: string;
  ctaText: string;
};

export const defaultMarketingCtaTargets = {
  webapp: true,
  extension: true,
  ios: true,
};

export type MarketingCtaTargets = typeof defaultMarketingCtaTargets;

export enum MarketingCtaStatus {
  Active = 'active',
  Inactive = 'inactive',
  Paused = 'paused',
}

@Entity()
export class MarketingCta {
  @PrimaryColumn({ type: 'text' })
  campaignId: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'text' })
  variant: MarketingCtaVariant;

  @Column({ type: 'text', default: MarketingCtaStatus.Active })
  status: MarketingCtaStatus;

  @Column({ type: 'jsonb', default: {} })
  flags: MarketingCtaFlags;

  @Column({ type: 'jsonb', default: defaultMarketingCtaTargets })
  targets: MarketingCtaTargets = defaultMarketingCtaTargets;
}
