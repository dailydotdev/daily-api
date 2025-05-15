import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { User } from './user';

export enum ClaimableItemTypes {
  Plus = 'plus',
}

@Entity()
export class ClaimableItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  @Index('IDX_claimable_item_email')
  email: string;

  @Column({ default: () => 'now()' })
  createdAt: Date;

  @Column({ nullable: true })
  claimedAt?: Date;

  @Column()
  type: ClaimableItemTypes;

  @Column({ type: 'jsonb', default: {} })
  flags = {};

  @Column({ nullable: true })
  claimedById?: string;

  @ManyToOne('User', { lazy: true, onDelete: 'SET NULL' })
  claimedBy?: Promise<User>;
}
