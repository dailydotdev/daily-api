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

@Entity()
export class MarketingCta {
  @PrimaryColumn({ type: 'text' })
  campaignId: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'text' })
  variant: MarketingCtaVariant;

  @Column({ type: 'jsonb', default: {} })
  flags: MarketingCtaFlags;
}
