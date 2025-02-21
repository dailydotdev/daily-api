import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from './User';
import type { Product } from '../Product';
import type { RequestMeta } from '../../Context';

export type UserTransactionFlags = Partial<{
  note: string;
}>;

export type UserTransactionFlagsPublic = Pick<UserTransactionFlags, 'note'>;

export type UserTransactionRequest = RequestMeta;

@Entity()
export class UserTransaction {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'uuid', nullable: true })
  productId: string | null;

  @ManyToOne('Product', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  product: Promise<Product>;

  @Column()
  status: number; // TODO feat/transactions enum from schema later

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
  user: Promise<User>;

  @Column({ nullable: true })
  senderId: string | null;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
    nullable: true,
  })
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
