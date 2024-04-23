import { Column, Entity, PrimaryColumn } from 'typeorm';

export type MarketingCtaVariant = 'card' | 'popover';

export type MarketingCtaFlags = {
  title: string;
  description?: string;
  image?: string;
  tagText?: string;
  tagColor?: string;
  ctaUrl: string;
  ctaText: string;
};

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
}
