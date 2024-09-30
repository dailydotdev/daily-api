import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from './user';
import type { Company } from './Company';

export type UserCompanyFlags = Partial<{
  rejected: boolean;
}>;

@Entity()
export class UserCompany {
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ default: false })
  verified: boolean;

  @PrimaryColumn({ type: 'text' })
  @Index({ unique: true })
  email: string;

  @Column({ type: 'text' })
  code: string;

  @PrimaryColumn()
  @Index('IDX_user_company_user_id')
  userId: string;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: Promise<User>;

  @Column()
  companyId: string;

  @OneToOne('Company', {
    nullable: true,
    lazy: true,
    onDelete: 'CASCADE',
  })
  company: Promise<Company>;

  @Column({ type: 'jsonb', default: {} })
  flags: UserCompanyFlags = {};
}
