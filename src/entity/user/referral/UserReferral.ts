import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  TableInheritance,
} from 'typeorm';
import type { User } from '../User';

export enum UserReferralType {
  Linkedin = 'linkedin',
}

@Entity()
@TableInheritance({ column: { type: 'text', name: 'type' } })
@Index('IDX_user_referral_id_type_visited', ['id', 'type', 'visited'])
export class UserReferral {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_user_referral_id_userId',
  })
  id: string;

  @PrimaryColumn({
    type: 'text',
    primaryKeyConstraintName: 'PK_user_referral_id_userId',
  })
  userId: string;

  @Column({ type: 'text' })
  @Index('IDX_user_referral_type')
  type: UserReferralType;

  @Column({ type: 'boolean', default: false })
  visited: boolean = false;

  @ManyToOne('User', { lazy: true, onDelete: 'CASCADE' })
  @JoinColumn({ foreignKeyConstraintName: 'FK_user_referral_user_userId' })
  user: Promise<User>;
}
