import { Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from './User';
import { MarketingCta } from '../MarketingCta';

@Entity()
export class UserMarketingCta {
  @PrimaryColumn({ type: 'text' })
  marketingCtaId: string;

  @PrimaryColumn({ type: 'text' })
  userId: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ nullable: true })
  readAt: Date;

  @ManyToOne(() => MarketingCta, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  marketingCta: MarketingCta;

  @ManyToOne(() => User, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}
