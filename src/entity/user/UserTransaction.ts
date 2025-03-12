import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from './User';
import type { Product } from '../Product';
import type { RequestMeta } from '../../Context';
import type { TransferStatus } from '@dailydotdev/schema';

export type UserTransactionFlags = Partial<{
  note: string;
}>;

export type UserTransactionFlagsPublic = Pick<UserTransactionFlags, 'note'>;

export type UserTransactionRequest = RequestMeta;

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
  status: TransferStatus;

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
}
