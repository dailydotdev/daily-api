import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ContributionPaymentStatus {
  Draft = 'draft',
  Finalized = 'finalized',
}

@Entity()
export class ContributionPayment {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_contribution_payment_id',
  })
  id: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'text', default: ContributionPaymentStatus.Draft })
  status: ContributionPaymentStatus;

  @Column({ type: 'integer', default: 0 })
  totalPoints: number;

  @Column({ type: 'integer', default: 0 })
  amountCents: number;

  @Column({ type: 'varchar', length: 36, nullable: true, default: null })
  createdBy: string | null;

  @Column({ type: 'timestamp', nullable: true, default: null })
  finalizedAt: Date | null;
}
