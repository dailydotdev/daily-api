import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import type { User } from './User';
import type { MarketingCta } from '../MarketingCta';

@Entity()
@Index('IDX_user_marketing_cta_userId_readAt_null', { synchronize: false })
export class UserMarketingCta {
  @PrimaryColumn({ type: 'text' })
  marketingCtaId: string;

  @PrimaryColumn({ type: 'text' })
  userId: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ nullable: true })
  readAt: Date;

  @ManyToOne('MarketingCta', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'marketingCtaId' })
  marketingCta: MarketingCta;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}
