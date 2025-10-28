import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  TableInheritance,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from '../User';

export enum UserReferralType {
  Linkedin = 'linkedin',
}

export enum UserReferralStatus {
  Pending = 'pending',
  Rejected = 'rejected',
  Accepted = 'accepted',
}

export type UserReferralFlags = Partial<{
  linkedinProfileUrl?: string;
  hashedRequestIP?: string; // Hashed IP address from which the referral link was requested
}>;

@Entity()
@TableInheritance({ column: { type: 'text', name: 'type' } })
@Index('IDX_user_referral_id_type_visited', ['id', 'type', 'visited'])
export class UserReferral {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_user_referral_id',
  })
  id: string;

  @Column({
    type: 'text',
  })
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'text' })
  @Index('IDX_user_referral_type')
  type: UserReferralType;

  @Column({ type: 'text', default: UserReferralStatus.Pending })
  @Index('IDX_user_referral_status')
  status: UserReferralStatus = UserReferralStatus.Pending;

  @Column({ type: 'boolean', default: false })
  visited: boolean = false;

  @Column({ type: 'jsonb', default: {} })
  flags: UserReferralFlags = {};

  @ManyToOne('User', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({ foreignKeyConstraintName: 'FK_user_referral_user_userId' })
  user: Promise<User>;
}
