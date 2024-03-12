import { Column, Entity, PrimaryColumn } from 'typeorm';

export type MarketingCtaVariant = 'card' | 'popover';

export type MarketingCtaFlags = Partial<{
  tagText: string;
  tagColor: string;
  ctaUrl: string;
  ctaText: string;
  description: string;
  image: string;
  title: string;
}>;

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
