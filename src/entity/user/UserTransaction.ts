import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { type User } from './User';
import type { Product } from '../Product';
import type { RequestMeta } from '../../Context';
import { TransferStatus } from '@dailydotdev/schema';
import { SubscriptionProvider } from '../../common/plus';

export type UserTransactionFlags = Partial<{
  note: string;
  providerId: string;
  error: string | null;
  emailSent: boolean;
  sourceId: string;
}>;

export type UserTransactionFlagsPublic = Pick<
  UserTransactionFlags,
  'note' | 'error' | 'sourceId'
>;

export type UserTransactionRequest = RequestMeta;

export enum UserTransactionStatus {
  Success = TransferStatus.SUCCESS,
  InsufficientFunds = TransferStatus.INSUFFICIENT_FUNDS,
  RateLimited = TransferStatus.RATE_LIMITED,
  InternalErrorNjord = TransferStatus.INTERNAL_ERROR,
  Created = 201,
  Processing = 202,
  Error = 500,
  ErrorRecoverable = 501,
}

export enum UserTransactionProcessor {
  Njord = 'njord',
  Paddle = SubscriptionProvider.Paddle,
  AppleStoreKit = SubscriptionProvider.AppleStoreKit,
}

export enum UserTransactionType {
  PostBoost = 'post_boost',
  SquadBoost = 'squad_boost',
  Post = 'post',
  Comment = 'comment',
  BriefGeneration = 'brief_generation',
  DecorationPurchase = 'decoration_purchase',
}

@Entity()
@Index('IDX_user_transaction_flags_providerId', { synchronize: false })
@Index('idx_user_transaction_receiverId_senderId_productId_status', {
  synchronize: false,
})
@Index('idx_user_transaction_value_desc', { synchronize: false })
@Index('idx_user_transaction_flags_sourceId', { synchronize: false })
export class UserTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  @Index('idx_user_transaction_productId')
  productId: string | null;

  @Column({ type: 'text', nullable: true })
  @Index('idx_user_transaction_referenceId')
  referenceId: string | null;

  @Column({ type: 'text', nullable: true })
  referenceType: string | null;

  @ManyToOne('Product', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  product: Promise<Product>;

  @Column({ type: 'integer' })
  @Index('idx_user_transaction_status')
  status: UserTransactionStatus;

  @CreateDateColumn()
  @Index('idx_user_transaction_createdAt', {
    synchronize: false,
  })
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column()
  @Index('idx_user_transaction_receiverId')
  receiverId: string;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'receiverId' })
  receiver: Promise<User>;

  @Column({ nullable: true })
  @Index('idx_user_transaction_senderId')
  senderId: string | null;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'senderId' })
  sender: Promise<User>;

  @Column()
  value: number;

  @Column()
  valueIncFees: number;

  @Column()
  fee: number;

  @Column({ type: 'jsonb', default: {} })
  request: UserTransactionRequest;

  @Column({ type: 'jsonb', default: {} })
  flags: UserTransactionFlags;

  @Column({ type: 'text' })
  processor: UserTransactionProcessor;
}
