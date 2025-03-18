import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SubscriptionProvider, type User } from './User';
import type { Product } from '../Product';
import type { RequestMeta } from '../../Context';
import { TransferStatus } from '@dailydotdev/schema';

export type UserTransactionFlags = Partial<{
  note: string;
  providerId: string;
  error: string;
}>;

export type UserTransactionFlagsPublic = Pick<
  UserTransactionFlags,
  'note' | 'error'
>;

export type UserTransactionRequest = RequestMeta;

export enum UserTransactionStatus {
  Success = TransferStatus.SUCCESS,
  InsufficientFunds = TransferStatus.INSUFFICIENT_FUNDS,
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

@Entity()
export class UserTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  productId: string | null;

  @ManyToOne('Product', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  product: Promise<Product>;

  @Column({ type: 'integer' })
  status: UserTransactionStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column()
  receiverId: string;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'receiverId' })
  receiver: Promise<User>;

  @Column({ nullable: true })
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
  fee: number;

  @Column({ type: 'jsonb', default: {} })
  request: UserTransactionRequest;

  @Column({ type: 'jsonb', default: {} })
  flags: UserTransactionFlags;

  @Column({ type: 'text' })
  processor: UserTransactionProcessor;
}
