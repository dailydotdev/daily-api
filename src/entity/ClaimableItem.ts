import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import type { User } from './user';

export enum ClaimableItemTypes {
  Subscription = 'subscription',
}

@Entity()
export class ClaimableItem {
  @PrimaryColumn()
  transactionId: string;

  @Column({ type: 'text', nullable: false })
  @Index('IDX_claimable_item_email')
  email: string;

  @Column({ nullable: false, default: () => 'now()' })
  createdAt: Date;

  @Column({ nullable: true })
  claimedAt?: Date;

  @Column({ nullable: false })
  type: string;

  @Column({ type: 'jsonb', default: {} })
  flags = {};

  @Column({ nullable: true })
  claimedById?: string;

  @ManyToOne('User', { lazy: true })
  claimedBy?: Promise<User>;
}
