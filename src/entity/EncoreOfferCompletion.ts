import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Ledger of Encore offer_completed webhook events. Delivery is a single
 * attempt with no retries, so every accepted event is persisted verbatim;
 * transactionId is Encore's idempotency key. Reconcile totals periodically
 * against the Encore dashboard — webhooks alone can undercount.
 */
@Entity()
export class EncoreOfferCompletion {
  @PrimaryColumn({ type: 'uuid' })
  transactionId: string;

  @Column({ type: 'text' })
  @Index('IDX_encore_offer_completion_user_id')
  userId: string;

  @Column({ type: 'text' })
  campaignName: string;

  @Column({ type: 'double precision', nullable: true })
  payout: number | null;

  @Column({ type: 'timestamptz' })
  @Index('IDX_encore_offer_completion_completed_at')
  completedAt: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  receivedAt: Date;
}
